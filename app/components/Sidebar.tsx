"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import EncomendaA4, { EncomendaA4Item } from "./EncomendaA4";
import { supabase } from "../../lib/supabase";

type BriocheItem = {
    id: number;
    codigo: string;
    pacotes: number;
    unidades: number;
    gergelim: boolean;
    aro: "60" | "80";
    cor: string;
};

type HistoricoPedido = {
    id: string;
    cliente_lanche: string;
    data_entrega: string;
    solicitante: string;
    observacao: string | null;
    created_at: string;
};

type ItemEntrega = EncomendaA4Item & {
    encomenda_id: string;
};

type EntregaHoje = HistoricoPedido & {
    itens: ItemEntrega[];
};

type Reimpressao = {
    chave: number;
    pedido: HistoricoPedido;
    itens: EncomendaA4Item[];
};

type EncomendaRascunho = {
    cliente: string;
    dataEntrega: string;
    solicitante: string;
    observacao: string;
    gergelim: boolean;
    pacotes: number;
    aro: "60" | "80";
    cor: string;
    itens: BriocheItem[];
};

const cores = ["Tradicional", "Vermelho", "Verde", "Azul", "Amarelo", "Mesclado"];
const maxPacotes = 34;
const quantidades = Array.from({ length: maxPacotes }, (_, index) => index + 1);
const clientesPredefinidos = [
    "MAIS KI GOSTOSO",
    "COMBINADOS LANCHE",
    "LANCHONETE D'LURDES",
    "WISH BURGUER",
    "AMAZON BURGUER",
];
const clientesStorageKey = "brioches-clientes-sugeridos";
const solicitantesPredefinidos = ["Fernanda", "Cristian", "Diana"];
const solicitantesStorageKey = "brioches-solicitantes-sugeridos";
const telaStorageKey = "brioches-ultima-tela";
const entregasDispensadasStorageKey = "brioches-entregas-dispensadas";
const encomendaRascunhoStorageKey = "brioches-encomenda-rascunho";
const historicoPaginaTamanho = 10;
const duracaoCacheMs = 30_000;
const historicoCache = new Map<number, { data: HistoricoPedido[]; total: number; expiraEm: number }>();
const entregasCache = new Map<string, { data: EntregaHoje[]; expiraEm: number }>();
const coresAcento = [
    { nome: "Azul", valor: "#2563eb" },
    { nome: "Verde", valor: "#16a34a" },
    { nome: "Vermelho", valor: "#dc2626" },
    { nome: "Roxo", valor: "#9333ea" },
] as const;

function destacarCorrespondencia(texto: string, busca: string) {
    if (!busca.trim()) return texto;

    const inicio = texto.toLowerCase().indexOf(busca.trim().toLowerCase());
    if (inicio < 0) return texto;

    return (
        <>
            {texto.slice(0, inicio)}
            <strong className="font-semibold text-base-content">{texto.slice(inicio, inicio + busca.trim().length)}</strong>
            {texto.slice(inicio + busca.trim().length)}
        </>
    );
}

function formatarDataEntrega(data: string) {
    const [ano, mes, dia] = data.split("-");
    return ano && mes && dia ? `${dia}/${mes}/${ano.slice(-2)}` : data;
}

function obterEntregasDispensadasHoje(dataHoje: string) {
    const chave = `${entregasDispensadasStorageKey}-${dataHoje}`;

    try {
        const ids = JSON.parse(window.localStorage.getItem(chave) || "[]");
        return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
    } catch {
        window.localStorage.removeItem(chave);
        return [];
    }
}

function invalidarCacheDePedidos() {
    historicoCache.clear();
    entregasCache.clear();
}

export default function Sidebar() {
    const [cliente, setCliente] = useState("");
    const [dataEntrega, setDataEntrega] = useState("");
    const [solicitante, setSolicitante] = useState("");
    const [observacao, setObservacao] = useState("");
    const [gergelim, setGergelim] = useState(true);
    const [pacotes, setPacotes] = useState(1);
    const [aro, setAro] = useState<"60" | "80">("80");
    const [cor, setCor] = useState(cores[0]);
    const [itens, setItens] = useState<BriocheItem[]>([]);
    const [tela, setTela] = useState<"inicio" | "entregar" | "historico" | "configuracoes">("inicio");
    const [historico, setHistorico] = useState<HistoricoPedido[]>([]);
    const [paginaHistorico, setPaginaHistorico] = useState(1);
    const [totalHistorico, setTotalHistorico] = useState(0);
    const [entregasDeHoje, setEntregasDeHoje] = useState<EntregaHoje[]>([]);
    const [pedidoSalvo, setPedidoSalvo] = useState(false);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [carregandoEntregas, setCarregandoEntregas] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [temaEscuro, setTemaEscuro] = useState(false);
    const [corAcento, setCorAcento] = useState("#dc2626");
    const [reimpressao, setReimpressao] = useState<Reimpressao | null>(null);
    const reimpressaoSequencia = useRef(0);
    const rascunhoCarregado = useRef(false);
    const [clientesSugeridos, setClientesSugeridos] = useState(clientesPredefinidos);
    const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
    const [sugestaoSelecionada, setSugestaoSelecionada] = useState(-1);
    const [solicitantesSugeridos, setSolicitantesSugeridos] = useState(solicitantesPredefinidos);
    const [mostrarSugestoesSolicitante, setMostrarSugestoesSolicitante] = useState(false);
    const [solicitanteSelecionado, setSolicitanteSelecionado] = useState(-1);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const telaSalva = window.localStorage.getItem(telaStorageKey);
            const temaSalvo = window.localStorage.getItem("brioches-tema") === "escuro";
            const corSalva = window.localStorage.getItem("brioches-cor-acento") || "#dc2626";
            const clientesSalvos = window.localStorage.getItem(clientesStorageKey);
            const solicitantesSalvos = window.localStorage.getItem(solicitantesStorageKey);
            const rascunhoSalvo = window.localStorage.getItem(encomendaRascunhoStorageKey);
            setTemaEscuro(temaSalvo);
            if (telaSalva === "inicio" || telaSalva === "entregar" || telaSalva === "historico" || telaSalva === "configuracoes") {
                setTela(telaSalva);
            }
            setCorAcento(corSalva);
            if (rascunhoSalvo) {
                try {
                    const rascunho = JSON.parse(rascunhoSalvo) as Partial<EncomendaRascunho>;
                    setCliente(typeof rascunho.cliente === "string" ? rascunho.cliente : "");
                    setDataEntrega(typeof rascunho.dataEntrega === "string" ? rascunho.dataEntrega : "");
                    setSolicitante(typeof rascunho.solicitante === "string" ? rascunho.solicitante : "");
                    setObservacao(typeof rascunho.observacao === "string" ? rascunho.observacao : "");
                    setGergelim(typeof rascunho.gergelim === "boolean" ? rascunho.gergelim : true);
                    setPacotes(typeof rascunho.pacotes === "number" ? Math.min(Math.max(rascunho.pacotes, 1), maxPacotes) : 1);
                    setAro(rascunho.aro === "60" || rascunho.aro === "80" ? rascunho.aro : "80");
                    setCor(typeof rascunho.cor === "string" ? rascunho.cor : cores[0]);
                    setItens(Array.isArray(rascunho.itens) ? rascunho.itens : []);
                } catch {
                    window.localStorage.removeItem(encomendaRascunhoStorageKey);
                }
            }
            rascunhoCarregado.current = true;
            if (clientesSalvos) {
                try {
                    const clientes = JSON.parse(clientesSalvos);
                    if (Array.isArray(clientes)) {
                        const clientesMaiusculos = clientes
                            .filter((cliente): cliente is string => typeof cliente === "string")
                            .map((cliente) => cliente.toUpperCase());
                        setClientesSugeridos(Array.from(new Set([...clientesPredefinidos, ...clientesMaiusculos])));
                    }
                } catch {
                    window.localStorage.removeItem(clientesStorageKey);
                }
            }
            if (solicitantesSalvos) {
                try {
                    const solicitantes = JSON.parse(solicitantesSalvos);
                    if (Array.isArray(solicitantes)) {
                        setSolicitantesSugeridos(Array.from(new Set([...solicitantesPredefinidos, ...solicitantes])));
                    }
                } catch {
                    window.localStorage.removeItem(solicitantesStorageKey);
                }
            }
            document.documentElement.dataset.theme = temaSalvo ? "brioches-dark" : "brioches-light";
            document.documentElement.style.setProperty("--color-primary", corSalva);
            document.documentElement.style.setProperty("--color-primary-content", "#ffffff");
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!rascunhoCarregado.current) return;

        if (!cliente && !dataEntrega && !solicitante && !observacao && itens.length === 0) {
            window.localStorage.removeItem(encomendaRascunhoStorageKey);
            return;
        }

        const rascunho: EncomendaRascunho = {
            cliente,
            dataEntrega,
            solicitante,
            observacao,
            gergelim,
            pacotes,
            aro,
            cor,
            itens,
        };
        window.localStorage.setItem(encomendaRascunhoStorageKey, JSON.stringify(rascunho));
    }, [cliente, dataEntrega, solicitante, observacao, gergelim, pacotes, aro, cor, itens]);

    function mudarTela(novaTela: "inicio" | "entregar" | "historico" | "configuracoes") {
        setTela(novaTela);
        window.localStorage.setItem(telaStorageKey, novaTela);
    }

    function alternarTema(escuro: boolean) {
        setTemaEscuro(escuro);
        window.localStorage.setItem("brioches-tema", escuro ? "escuro" : "claro");
        document.documentElement.dataset.theme = escuro ? "brioches-dark" : "brioches-light";
    }

    function alterarCorAcento(cor: string) {
        setCorAcento(cor);
        window.localStorage.setItem("brioches-cor-acento", cor);
        document.documentElement.style.setProperty("--color-primary", cor);
        document.documentElement.style.setProperty("--color-primary-content", "#ffffff");
    }

    function obterDataHoje() {
        const hoje = new Date();
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const dia = String(hoje.getDate()).padStart(2, "0");
        return `${hoje.getFullYear()}-${mes}-${dia}`;
    }

    function salvarClienteSugerido(valor: string) {
        const clienteSalvo = valor.trim().toUpperCase();
        if (!clienteSalvo) return;

        setClientesSugeridos((clientesAtuais) => {
            const clientesAtualizados = [
                clienteSalvo,
                ...clientesAtuais.filter((clienteAtual) => clienteAtual.toLowerCase() !== clienteSalvo.toLowerCase()),
            ];
            window.localStorage.setItem(clientesStorageKey, JSON.stringify(clientesAtualizados));
            return clientesAtualizados;
        });
    }

    function removerClienteSugerido(clienteParaRemover: string) {
        if (clientesPredefinidos.includes(clienteParaRemover)) return;

        setClientesSugeridos((clientesAtuais) => {
            const clientesAtualizados = clientesAtuais.filter((clienteAtual) => clienteAtual !== clienteParaRemover);
            window.localStorage.setItem(clientesStorageKey, JSON.stringify(clientesAtualizados));
            return clientesAtualizados;
        });
    }

    function salvarSolicitanteSugerido(valor: string) {
        const solicitanteSalvo = valor.trim();
        if (!solicitanteSalvo) return;

        setSolicitantesSugeridos((solicitantesAtuais) => {
            const solicitantesAtualizados = [
                solicitanteSalvo,
                ...solicitantesAtuais.filter((solicitanteAtual) => solicitanteAtual.toLowerCase() !== solicitanteSalvo.toLowerCase()),
            ];
            window.localStorage.setItem(solicitantesStorageKey, JSON.stringify(solicitantesAtualizados));
            return solicitantesAtualizados;
        });
    }

    const clientesFiltrados = clientesSugeridos
        .filter((clienteSugerido) => clienteSugerido.toLowerCase().includes(cliente.trim().toLowerCase()))
        .slice(0, 6);
    const solicitantesFiltrados = solicitantesSugeridos
        .filter((solicitanteSugerido) => solicitanteSugerido.toLowerCase().includes(solicitante.trim().toLowerCase()))
        .slice(0, 6);

    function adicionarItem(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setItens((itensAtuais) => [
            ...itensAtuais,
            {
                id: Date.now(),
                codigo: gergelim ? "3656" : "5854",
                pacotes,
                unidades: pacotes * 12,
                gergelim,
                aro,
                cor,
            },
        ]);
    }

    function removerItem(itemId: number) {
        setItens((itensAtuais) => itensAtuais.filter((item) => item.id !== itemId));
        setPedidoSalvo(false);
        setMensagem("");
    }

    function limparEncomenda() {
        if (!window.confirm("Limpar todos os dados e itens desta encomenda?")) return;

        setCliente("");
        setDataEntrega("");
        setSolicitante("");
        setObservacao("");
        setGergelim(true);
        setPacotes(1);
        setAro("80");
        setCor(cores[0]);
        setItens([]);
        setPedidoSalvo(false);
        setMensagem("");
        window.localStorage.removeItem(encomendaRascunhoStorageKey);
    }

    async function salvarPedido(): Promise<boolean> {
        setMensagem("");
        salvarClienteSugerido(cliente);
        salvarSolicitanteSugerido(solicitante);

        if (pedidoSalvo) {
            return true;
        }

        if (!cliente.trim() || !dataEntrega || !solicitante.trim() || itens.length === 0) {
            setMensagem("Preencha cliente, data de entrega, solicitante e adicione pelo menos um item.");
            return false;
        }

        if (itens.some((item) => item.pacotes < 1 || item.pacotes > maxPacotes)) {
            setMensagem(`Cada item deve ter entre 1 e ${maxPacotes} pacotes.`);
            return false;
        }

        const { data: encomenda, error: erroEncomenda } = await supabase
            .from("encomendas")
            .insert({
                cliente_lanche: cliente.trim(),
                data_entrega: dataEntrega,
                solicitante: solicitante.trim(),
                observacao: observacao.trim() || null,
            })
            .select("id")
            .single();

        if (erroEncomenda || !encomenda) {
            setMensagem(`Não foi possível salvar a encomenda: ${erroEncomenda?.message || "resposta inválida"}`);
            return false;
        }

        const itensParaSalvar = itens.map((item) => ({
            encomenda_id: encomenda.id,
            codigo: item.codigo,
            quantidade: item.pacotes,
            unidade: item.pacotes * 12,
            gergelim: item.gergelim,
            aro: item.aro,
            cor: item.cor,
        }));

        const { error: erroItens } = await supabase.from("itens_encomenda").insert(itensParaSalvar);

        if (erroItens) {
            await supabase.from("encomendas").delete().eq("id", encomenda.id);
            const detalhesErro = [erroItens.message, erroItens.details, erroItens.hint].filter(Boolean).join(" ");
            setMensagem(`A encomenda não foi concluída: ${detalhesErro || "erro ao salvar os itens"}`);
            return false;
        }

        setPedidoSalvo(true);
        setMensagem("Encomenda salva com sucesso.");
        window.localStorage.removeItem(encomendaRascunhoStorageKey);
        invalidarCacheDePedidos();
        return true;
    }

    async function carregarHistorico(pagina: number) {
        setMensagem("");
        setCarregandoHistorico(true);

        const cache = historicoCache.get(pagina);
        if (cache && cache.expiraEm > Date.now()) {
            setHistorico(cache.data);
            setPaginaHistorico(pagina);
            setTotalHistorico(cache.total);
            setCarregandoHistorico(false);
            return;
        }

        const inicio = (pagina - 1) * historicoPaginaTamanho;
        const { data, count, error } = await supabase
            .from("encomendas")
            .select("id, cliente_lanche, data_entrega, solicitante, observacao, created_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(inicio, inicio + historicoPaginaTamanho - 1);

        setCarregandoHistorico(false);

        if (error) {
            setMensagem(`Não foi possível carregar o histórico: ${error.message}`);
            return;
        }

        setHistorico(data || []);
        setPaginaHistorico(pagina);
        setTotalHistorico(count || 0);
        historicoCache.set(pagina, {
            data: data || [],
            total: count || 0,
            expiraEm: Date.now() + duracaoCacheMs,
        });
    }

    async function abrirHistorico() {
        mudarTela("historico");
    }

    useEffect(() => {
        if (tela !== "historico") return;

        const timer = window.setTimeout(() => void carregarHistorico(1), 0);
        return () => window.clearTimeout(timer);
    }, [tela]);

    const carregarEntregasDeHoje = useCallback(async () => {
        const dataHoje = obterDataHoje();
        const cache = entregasCache.get(dataHoje);
        setCarregandoEntregas(true);

        if (cache && cache.expiraEm > Date.now()) {
            setEntregasDeHoje(cache.data);
            setCarregandoEntregas(false);
            return;
        }

        const { data, error } = await supabase
            .from("encomendas")
            .select("id, cliente_lanche, data_entrega, solicitante, observacao, created_at")
            .eq("data_entrega", dataHoje)
            .order("created_at", { ascending: false });

        if (error) {
            setCarregandoEntregas(false);
            setMensagem(`Não foi possível carregar as entregas: ${error.message}`);
            return;
        }

        const pedidos = data || [];
        const { data: itensData, error: erroItens } = pedidos.length > 0
            ? await supabase
                .from("itens_encomenda")
                .select("encomenda_id, codigo, quantidade, unidade, gergelim, aro, cor")
                .in("encomenda_id", pedidos.map((pedido) => pedido.id))
            : { data: [], error: null };

        setCarregandoEntregas(false);

        if (erroItens) {
            setMensagem(`Não foi possível carregar os itens das entregas: ${erroItens.message}`);
        }

        const itens = (itensData || []) as ItemEntrega[];
        const dispensadas = new Set(obterEntregasDispensadasHoje(dataHoje));
        const entregas = pedidos.filter((pedido) => !dispensadas.has(pedido.id)).map((pedido) => ({
            ...pedido,
            itens: itens.filter((item) => item.encomenda_id === pedido.id),
        }));
        entregasCache.set(dataHoje, { data: entregas, expiraEm: Date.now() + duracaoCacheMs });
        setEntregasDeHoje(entregas);
    }, []);

    async function abrirEntregas() {
        mudarTela("entregar");
        setMensagem("");
        await carregarEntregasDeHoje();
    }

    useEffect(() => {
        let ativo = true;

        const timer = window.setTimeout(() => {
            if (ativo) void carregarEntregasDeHoje();
        }, 0);

        return () => {
            ativo = false;
            window.clearTimeout(timer);
        };
    }, [carregarEntregasDeHoje]);

    function dispensarEntrega(id: string) {
        const chave = `${entregasDispensadasStorageKey}-${obterDataHoje()}`;
        const dispensadas = new Set(obterEntregasDispensadasHoje(obterDataHoje()));
        dispensadas.add(id);
        window.localStorage.setItem(chave, JSON.stringify([...dispensadas]));
        entregasCache.delete(obterDataHoje());
        setEntregasDeHoje((entregasAtuais) => entregasAtuais.filter((entrega) => entrega.id !== id));
    }

    async function removerPedido(pedido: HistoricoPedido) {
        const confirmado = window.confirm(`Apagar a encomenda de ${pedido.cliente_lanche}?`);
        if (!confirmado) return;

        setMensagem("");
        const { error } = await supabase.from("encomendas").delete().eq("id", pedido.id);

        if (error) {
            setMensagem(`Não foi possível apagar a encomenda: ${error.message}`);
            return;
        }

        invalidarCacheDePedidos();
        setHistorico((pedidosAtuais) => pedidosAtuais.filter((pedidoAtual) => pedidoAtual.id !== pedido.id));
        setMensagem("Encomenda apagada com sucesso.");
    }

    async function reimprimirPedido(pedido: HistoricoPedido) {
        setMensagem("");
        const { data, error } = await supabase
            .from("itens_encomenda")
            .select("codigo, quantidade, unidade, gergelim, aro, cor")
            .eq("encomenda_id", pedido.id);

        if (error) {
            setMensagem(`Não foi possível recuperar os itens da encomenda: ${error.message}`);
            return;
        }

        reimpressaoSequencia.current += 1;
        setReimpressao({
            chave: reimpressaoSequencia.current,
            pedido,
            itens: (data || []).map((item) => ({
                codigo: item.codigo,
                quantidade: item.quantidade,
                unidade: item.unidade,
                gergelim: item.gergelim,
                aro: item.aro,
                cor: item.cor,
            })),
        });
    }

    return (
        <div className="drawer min-h-screen bg-base-200 lg:drawer-open">
            <input id="navigation-drawer" type="checkbox" className="drawer-toggle" />

            <div className="drawer-content flex min-h-screen flex-col">


                <main className="flex-1 p-4 lg:p-8">
                    {tela === "inicio" && <div className="mx-auto max-w-6xl">
                        <div className="mb-8 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Nova encomenda</p>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight text-base-content">Preencha os dados e adicione os itens do pedido.</h1>
                                <p className="mt-2 text-sm text-base-content/60"></p>
                            </div>
                            <button type="button" onClick={limparEncomenda} className="trash-button btn btn-outline btn-error btn-sm shrink-0 gap-2" title="Limpar todos os campos e itens">
                                <span className="hidden sm:inline">Limpar Encomenda</span>
                            </button>
                        </div>

                        <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm lg:p-7">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                                    <span className="text-sm font-bold">01</span>
                                </div>
                                <div>
                                    <h2 className="font-bold">Dados da encomenda</h2>
                                    <p className="text-xs text-base-content/60">Informações para identificação e entrega</p>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <div className="form-control relative lg:col-span-2">
                                    <span className="label-text mb-2 text-sm font-medium">Cliente / Lanche</span>
                                    <div className="relative">
                                        <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-base-content/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                            <circle cx="11" cy="11" r="7" />
                                            <path strokeLinecap="round" d="m20 20-4-4" />
                                        </svg>
                                        <input
                                            id="cliente-lanche"
                                            value={cliente}
                                            onChange={(event) => {
                                                setCliente(event.target.value.toUpperCase());
                                                setMostrarSugestoes(true);
                                                setSugestaoSelecionada(-1);
                                            }}
                                            onFocus={() => setMostrarSugestoes(true)}
                                            onBlur={() => {
                                                window.setTimeout(() => setMostrarSugestoes(false), 150);
                                                salvarClienteSugerido(cliente);
                                            }}
                                            onKeyDown={(event) => {
                                                if (!mostrarSugestoes || clientesFiltrados.length === 0) return;
                                                if (event.key === "ArrowDown") {
                                                    event.preventDefault();
                                                    setSugestaoSelecionada((indice) => Math.min(indice + 1, clientesFiltrados.length - 1));
                                                } else if (event.key === "ArrowUp") {
                                                    event.preventDefault();
                                                    setSugestaoSelecionada((indice) => Math.max(indice - 1, 0));
                                                } else if (event.key === "Enter" && sugestaoSelecionada >= 0) {
                                                    event.preventDefault();
                                                    setCliente(clientesFiltrados[sugestaoSelecionada]);
                                                    setMostrarSugestoes(false);
                                                } else if (event.key === "Escape") {
                                                    setMostrarSugestoes(false);
                                                }
                                            }}
                                            type="text"
                                            placeholder="Ex.: Lanche do Alvorada"
                                            autoComplete="off"
                                            className="input input-bordered w-full pr-9"
                                        />
                                        {mostrarSugestoes && clientesFiltrados.length > 0 && (
                                            <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-base-300 bg-base-100 py-2 shadow-xl">
                                                <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-base-content/45">Sugestões</p>
                                                {clientesFiltrados.map((clienteSugerido, indice) => {
                                                    return (
                                                        <div key={clienteSugerido} className={`flex items-center ${indice === sugestaoSelecionada ? "bg-base-200" : "hover:bg-base-200"}`}>
                                                            <button
                                                                type="button"
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                onClick={() => {
                                                                    setCliente(clienteSugerido);
                                                                    setMostrarSugestoes(false);
                                                                    setSugestaoSelecionada(-1);
                                                                }}
                                                                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left text-sm"
                                                            >
                                                                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-base-200 text-base-content/55">
                                                                    <svg className="text-cyan-700" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q560-607 560-640t-23.5-56.5Q513-720 480-720t-56.5 23.5Q400-673 400-640t23.5 56.5Q447-560 480-560t56.5-23.5ZM480-640Zm0 400Z" /></svg>
                                                                </span>
                                                                <span className="truncate">{destacarCorrespondencia(clienteSugerido, cliente)}</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                onClick={() => removerClienteSugerido(clienteSugerido)}
                                                                className="mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none text-base-content/60 transition-colors hover:bg-error/10 hover:text-error"
                                                                aria-label={`Apagar sugestão ${clienteSugerido}`}
                                                                title="Apagar sugestão"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="24px" fill="#999999"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Data de entrega</span>
                                    <input value={dataEntrega} onChange={(event) => setDataEntrega(event.target.value)} type="date" className="input input-bordered w-full" />
                                </label>
                                <div className="form-control relative">
                                    <span className="label-text mb-2 text-sm font-medium">Solicitante</span>
                                    <div className="relative">
                                        <input
                                            value={solicitante}
                                            onChange={(event) => {
                                                setSolicitante(event.target.value);
                                                setMostrarSugestoesSolicitante(true);
                                                setSolicitanteSelecionado(-1);
                                            }}
                                            onFocus={() => setMostrarSugestoesSolicitante(true)}
                                            onBlur={() => {
                                                window.setTimeout(() => setMostrarSugestoesSolicitante(false), 150);
                                                salvarSolicitanteSugerido(solicitante);
                                            }}
                                            onKeyDown={(event) => {
                                                if (!mostrarSugestoesSolicitante || solicitantesFiltrados.length === 0) return;
                                                if (event.key === "ArrowDown") {
                                                    event.preventDefault();
                                                    setSolicitanteSelecionado((indice) => Math.min(indice + 1, solicitantesFiltrados.length - 1));
                                                } else if (event.key === "ArrowUp") {
                                                    event.preventDefault();
                                                    setSolicitanteSelecionado((indice) => Math.max(indice - 1, 0));
                                                } else if (event.key === "Enter" && solicitanteSelecionado >= 0) {
                                                    event.preventDefault();
                                                    setSolicitante(solicitantesFiltrados[solicitanteSelecionado]);
                                                    setMostrarSugestoesSolicitante(false);
                                                } else if (event.key === "Escape") {
                                                    setMostrarSugestoesSolicitante(false);
                                                }
                                            }}
                                            type="text"
                                            placeholder="Nome do solicitante"
                                            autoComplete="off"
                                            className="input input-bordered w-full"
                                        />
                                        {mostrarSugestoesSolicitante && solicitantesFiltrados.length > 0 && (
                                            <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-base-300 bg-base-100 py-2 shadow-xl">
                                                <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-base-content/45">Sugestões</p>
                                                {solicitantesFiltrados.map((solicitanteSugerido, indice) => (
                                                    <button
                                                        key={solicitanteSugerido}
                                                        type="button"
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => {
                                                            setSolicitante(solicitanteSugerido);
                                                            setMostrarSugestoesSolicitante(false);
                                                            setSolicitanteSelecionado(-1);
                                                        }}
                                                        className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${indice === solicitanteSelecionado ? "bg-base-200" : "hover:bg-base-200"}`}
                                                    >
                                                        {destacarCorrespondencia(solicitanteSugerido, solicitante)}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <label className="form-control md:col-span-2">
                                    <span className="label-text mb-2 text-sm font-medium">Observação <span className="font-normal text-base-content/50">(opcional)</span></span>
                                    <input value={observacao} onChange={(event) => setObservacao(event.target.value)} type="text" placeholder="Alguma informação importante sobre a entrega" className="input input-bordered w-full" />
                                </label>
                            </div>
                        </section>

                        <section className="mt-5 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm lg:p-7">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="grid size-9 place-items-center rounded-full bg-secondary/10 text-secondary">
                                    <span className="text-sm text-primary font-bold">02</span>
                                </div>
                                <div>
                                    <h2 className="font-bold">Itens da encomenda</h2>
                                    <p className="text-xs text-base-content/60">Adicione os brioches e suas especificações</p>
                                </div>
                            </div>

                            <form onSubmit={adicionarItem} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Gergelim</span>
                                    <select value={gergelim ? "com" : "sem"} onChange={(event) => setGergelim(event.target.value === "com")} className="select select-bordered w-full">
                                        <option value="com">Com gergelim</option>
                                        <option value="sem">Sem gergelim</option>
                                    </select>
                                </label>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Código</span>
                                    <input value={gergelim ? "3656" : "5854"} readOnly className="input input-bordered w-full bg-base-200 font-mono font-semibold" />
                                </label>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Quantidade</span>
                                    <select value={pacotes} onChange={(event) => setPacotes(Number(event.target.value))} className="select select-bordered w-full">
                                        {quantidades.map((quantidade) => <option key={quantidade} value={quantidade}>{quantidade} {quantidade === 1 ? "pacote" : "pacotes"}</option>)}
                                    </select>
                                </label>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Unidades</span>
                                    <input value={`${pacotes * 12} unidades`} readOnly className="input input-bordered w-full bg-base-200" />
                                </label>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Aro</span>
                                    <select value={aro} onChange={(event) => setAro(event.target.value as "60" | "80")} className="select select-bordered w-full">
                                        <option value="60">60</option>
                                        <option value="80">80</option>
                                    </select>
                                </label>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Cor</span>
                                    <select value={cor} onChange={(event) => setCor(event.target.value)} className="select select-bordered w-full">
                                        {cores.map((corDisponivel) => <option key={corDisponivel}>{corDisponivel}</option>)}
                                    </select>
                                </label>
                                <div className="flex items-end md:col-span-2 lg:col-span-2">
                                    <button type="submit" className="btn btn-primary w-full shadow-sm">
                                        <span className="text-lg leading-none">+</span>
                                        Adicionar brioche
                                    </button>
                                </div>
                            </form>

                            {itens.length > 0 && (
                                <div className="mt-7 overflow-x-auto rounded-xl border border-base-300">
                                    <table className="table">
                                        <thead><tr><th>Código</th><th>Quantidade</th><th>Unidades</th><th>Aro</th><th>Cor</th><th>Ações</th></tr></thead>
                                        <tbody>{itens.map((item) => <tr key={item.id}><td className="font-mono font-semibold">{item.codigo}</td><td>{item.pacotes} {item.pacotes === 1 ? "pacote" : "pacotes"}</td><td>{item.unidades}</td><td>{item.aro}</td><td>{item.cor}</td><td><button type="button" onClick={() => removerItem(item.id)} className="btn btn-ghost btn-xs text-error" aria-label={`Apagar item ${item.codigo}`}>Apagar</button></td></tr>)}</tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        <div className="mt-8 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm lg:p-7">
                            <div className="mb-5">
                                <h2 className="font-bold">Ficha da encomenda</h2>
                                <p className="mt-1 text-sm text-base-content/60">Imprimir a ficha com os dados preenchidos acima.</p>
                            </div>
                            <EncomendaA4
                                clienteLanche={cliente}
                                dataEntrega={dataEntrega}
                                solicitante={solicitante}
                                observacao={observacao}
                                itens={itens.map((item) => ({
                                    codigo: item.codigo,
                                    quantidade: item.pacotes,
                                    unidade: item.unidades,
                                    gergelim: item.gergelim,
                                    aro: item.aro,
                                    cor: item.cor,
                                }))}
                                onSalvar={salvarPedido}
                            />
                        </div>
                    </div>}

                    {tela === "historico" && (
                        <div className="mx-auto max-w-6xl">
                            <div className="mb-8 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Pedidos salvos</p>
                                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-base-content">Histórico</h1>
                                    <p className="mt-2 text-sm text-base-content/60">Consulte as encomendas registradas no banco de dados.</p>
                                </div>
                                <button type="button" onClick={() => void abrirHistorico()} className="btn btn-outline btn-sm">Atualizar</button>
                            </div>

                            {mensagem && <p className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">{mensagem}</p>}
                            <div className="overflow-x-auto rounded-2xl border border-base-300 bg-base-100 shadow-sm">
                                {carregandoHistorico ? (
                                    <div className="flex min-h-40 items-center justify-center p-8" aria-label="Carregando histórico">
                                        <ThreeDot color={corAcento} size="medium" text="" textColor="" />
                                    </div>
                                ) : historico.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-base-content/60">Nenhuma encomenda salva.</div>
                                ) : (
                                    <table className="table">
                                        <thead><tr><th>Cliente / Lanche</th><th>Entrega</th><th>Solicitante</th><th>Criado em</th><th>Ações</th></tr></thead>
                                        <tbody>
                                            {historico.map((pedido) => (
                                                <tr key={pedido.id}>
                                                    <td className="font-semibold">{pedido.cliente_lanche}</td>
                                                    <td>{formatarDataEntrega(pedido.data_entrega)}</td>
                                                    <td>{pedido.solicitante}</td>
                                                    <td>{new Date(pedido.created_at).toLocaleString("pt-BR")}</td>
                                                    <td>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button type="button" onClick={() => void reimprimirPedido(pedido)} className="btn btn-sm btn-outline btn-primary gap-2 rounded-lg transition-colors" title="Reimprimir PDF" aria-label={`Reimprimir PDF de ${pedido.cliente_lanche}`}>
                                                                <svg className="h-6 w-6" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                                                                    <path stroke="currentColor" strokeLinejoin="round" strokeWidth="2" d="M16.444 18H19a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2.556M17 11V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v6h10ZM7 15h10v4a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-4Z" />
                                                                </svg>
                                                                <span className="hidden sm:inline">Reimprimir</span>
                                                            </button>
                                                            <button type="button" onClick={() => void removerPedido(pedido)} className="btn btn-sm btn-outline btn-error gap-2 rounded-lg transition-colors" title="Apagar encomenda" aria-label={`Apagar encomenda de ${pedido.cliente_lanche}`}>
                                                                <span className="hidden sm:inline">Apagar</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {!carregandoHistorico && totalHistorico > 0 && (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-sm shadow-sm">
                                    <span className="text-base-content/60">Página {paginaHistorico} de {Math.ceil(totalHistorico / historicoPaginaTamanho)} · {totalHistorico} encomendas</span>
                                    <div className="flex gap-2">
                                        <button type="button" className="btn btn-sm btn-outline" disabled={paginaHistorico === 1} onClick={() => void carregarHistorico(paginaHistorico - 1)}>Anterior</button>
                                        <button type="button" className="btn btn-sm btn-primary" disabled={paginaHistorico >= Math.ceil(totalHistorico / historicoPaginaTamanho)} onClick={() => void carregarHistorico(paginaHistorico + 1)}>Próxima</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tela === "entregar" && (
                        <div className="mx-auto max-w-6xl">
                            <div className="mb-8 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Pedidos do Dia</p>
                                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-base-content">Encomendas previstas para entrega hoje.</h1>

                                </div>
                                <button type="button" onClick={() => void abrirEntregas()} className="btn btn-outline btn-sm">Atualizar</button>
                            </div>

                            {mensagem && <p className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">{mensagem}</p>}
                            {carregandoEntregas ? (
                                <div className="flex min-h-56 items-center justify-center rounded-2xl border border-base-300 bg-base-100 p-10 shadow-sm" aria-label="Carregando entregas">
                                    <ThreeDot color={corAcento} size="medium" text="" textColor="" />
                                </div>
                            ) : entregasDeHoje.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-10 text-center shadow-sm">
                                    <p className="font-semibold text-base-content">Nenhuma entrega para hoje</p>
                                    <p className="mt-1 text-sm text-base-content/60">As encomendas com data de hoje aparecerão aqui.</p>
                                </div>
                            ) : (
                                <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {entregasDeHoje.map((pedido, indice) => (
                                        <article key={pedido.id} className="flex h-[540px] min-h-0 flex-col rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{indice + 1}</span>
                                                <span className="rounded-full bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/70">{formatarDataEntrega(pedido.data_entrega)}</span>
                                            </div>
                                            <h2 className="mt-5 text-xl font-bold text-base-content">{pedido.cliente_lanche}</h2>
                                            <div className="mt-3 space-y-1 text-sm text-base-content/70">
                                                <p><span className="font-semibold text-base-content">Solicitante:</span> {pedido.solicitante}</p>
                                                <p><span className="font-semibold text-base-content">Criada em:</span> {new Date(pedido.created_at).toLocaleString("pt-BR")}</p>
                                            </div>
                                            <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-base-300 pt-3">
                                                <p className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-base-content/50">Itens</p>
                                                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                                    {pedido.itens.length === 0 ? (
                                                        <p className="text-sm text-base-content/50">Nenhum item encontrado.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {pedido.itens.map((item) => (
                                                                <div key={`${item.codigo}-${item.aro}-${item.cor}`} className="flex items-center justify-between gap-3 text-sm">
                                                                    <span className="font-mono font-semibold text-base-content">{item.codigo} <span className="font-sans font-normal text-base-content/60">({item.gergelim ? "com" : "sem"} gergelim)</span></span>
                                                                    <span className="text-right text-base-content/70">{item.quantidade} pac. / {item.unidade} un.<br /><span className="text-xs">Aro {item.aro} · {item.cor}</span></span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex min-h-[52px] shrink-0 items-start">
                                                {pedido.observacao && <p className="w-full overflow-hidden rounded-lg bg-warning/10 px-3 py-2 text-sm text-base-content"><span className="font-semibold">Observação:</span> {pedido.observacao}</p>}
                                            </div>
                                            <button type="button" onClick={() => dispensarEntrega(pedido.id)} className="btn btn-outline btn-sm mt-3 w-full shrink-0">Dispensar</button>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tela === "configuracoes" && (
                        <div className="mx-auto max-w-4xl">
                            <div className="mb-8">
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Preferências</p>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight text-base-content">Configurações</h1>
                                <p className="mt-2 text-sm text-base-content/60">Ajuste a aparência e o comportamento da central.</p>
                            </div>

                            <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm lg:p-7">
                                <div className="flex items-center justify-between gap-4 border-b border-base-300 pb-5">
                                    <div>
                                        <h2 className="font-bold">Aparência</h2>
                                        <p className="mt-1 text-sm text-base-content/60">Escolha como a central será exibida.</p>
                                    </div>
                                    <span className="badge badge-primary badge-outline">Cor de destaque</span>
                                </div>

                                <div className="py-5">
                                    <p className="font-medium">Cor de destaque</p>
                                    <p className="mt-1 text-sm text-base-content/60">Escolha a cor principal da interface.</p>
                                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {coresAcento.map((opcao) => (
                                            <button
                                                key={opcao.nome}
                                                type="button"
                                                onClick={() => alterarCorAcento(opcao.valor)}
                                                className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition ${corAcento === opcao.valor ? "border-base-content ring-2 ring-primary ring-offset-2" : "border-base-300 hover:border-base-content/40"}`}
                                            >
                                                <span className="size-5 rounded-full" style={{ backgroundColor: opcao.valor }} />
                                                {opcao.nome}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <label className="flex cursor-pointer items-center justify-between gap-4 py-5">
                                    <span>
                                        <span className="block font-medium">Modo escuro</span>
                                        <span className="mt-1 block text-sm text-base-content/60">Alterna entre o tema claro e o tema escuro.</span>
                                    </span>
                                    <input type="checkbox" className="toggle toggle-primary" checked={temaEscuro} onChange={(event) => alternarTema(event.target.checked)} />
                                </label>

                            </section>

                            <p className="mt-8 text-center text-xs text-base-content/50">
                                Desenvolvido por <span className="font-semibold text-base-content/70">Cristian Almeida - Full Stack Developer</span>
                            </p>
                        </div>
                    )}

                    {reimpressao && (
                        <div className="hidden" aria-hidden="true">
                            <EncomendaA4
                                key={reimpressao.chave}
                                clienteLanche={reimpressao.pedido.cliente_lanche}
                                dataEntrega={reimpressao.pedido.data_entrega}
                                solicitante={reimpressao.pedido.solicitante}
                                observacao={reimpressao.pedido.observacao || ""}
                                dataSolicitada={reimpressao.pedido.created_at.slice(0, 10)}
                                itens={reimpressao.itens}
                                baixarAutomaticamente
                            />
                        </div>
                    )}
                </main>
            </div>

            <div className="drawer-side">
                <label htmlFor="navigation-drawer" aria-label="Fechar navegação" className="drawer-overlay" />
                <aside className="flex min-h-full w-72 flex-col border-r border-base-300 bg-base-100 px-4 py-5 text-base-content shadow-xl">
                    <div className="flex min-h-[72px] items-center gap-3 rounded-2xl px-3 py-3">
                        <div id="logo" className="grid size-11 shrink-0 place-items-center overflow-hidden p-1">
                            <Image src="/favicon.ico" alt="Logo Conde do Pão" width={40} height={40} className="size-full object-cover" />
                        </div>
                        <div className="min-w-0">
                            <div id="text-layer" className="relative h-6 w-36">
                                <Image src="/textlayer.webp" alt="Conde do Pão" fill sizes="144px" className="object-contain object-left" />
                            </div>
                            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-base-content/55">Brioche encomendas</p>
                        </div>
                    </div>

                    <nav className="mt-8 flex-1 px-1" aria-label="Navegação principal">
                        <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-base-content/45">Operação</p>
                        <ul className="menu gap-1.5 p-0">
                            <li>
                                <Link href="/" onClick={() => mudarTela("inicio")} className={`flex min-h-12 items-center rounded-xl px-3 py-3 ${tela === "inicio" ? "bg-primary/10 font-semibold text-primary" : "text-base-content/70 hover:bg-base-200"}`}>
                                    <svg className="fill-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="#EA3323"><path d="M5,21q-0.83,0-1.41-0.59T3,19V5Q3,4.17 3.59,3.59T5,3H9.2q0.32-0.9 1.09-1.45T12,1t1.71,0.55T14.8,3H19q0.83,0 1.41,0.59T21,5V19q0,0.82-0.59,1.41T19,21H5Zm0-2H19V5H5V19Zm2-2h7V15H7v2Zm0-4H17V11H7v2ZM7,9H17V7H7V9Zm5.54-4.96q0.21-0.21 0.21-0.54q0-0.33-0.21-0.54T12,2.75T11.46,2.96T11.25,3.5q0,0.32 0.21,0.54T12,4.25t0.54-0.21ZM5,19V5V19Z" /></svg>
                                    <span>Encomendar</span>
                                    <svg className="ml-auto size-[18px] opacity-50" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9.29 6.71 1.42-1.42L16.42 11a1.4 1.4 0 0 1 0 2l-5.71 5.71-1.42-1.42L13.59 12 9.29 6.71Z" /></svg>
                                </Link>
                            </li>
                            <li>
                                <a href="#entregar" onClick={(event) => { event.preventDefault(); void abrirEntregas(); }} className={`flex min-h-12 items-center rounded-xl px-3 py-3 ${tela === "entregar" ? "bg-primary/10 font-semibold text-primary" : "text-base-content/70 hover:bg-base-200"}`}>
                                    <svg className="fill-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="#EA3323"><path d="M6,22q-0.82,0-1.41-0.59T4,20V8Q4,7.18 4.59,6.59T6,6H8Q8,4.35 9.18,3.17T12,2t2.83,1.17T16,6h2q0.82,0 1.41,0.59Q20,7.18 20,8V20q0,0.82-0.59,1.41T18,22H6Zm0-2H18V8H16v2q0,0.42-0.29,0.71T15,11t-0.71-0.29Q14,10.43 14,10V8H10v2q0,0.42-0.29,0.71T9,11q-0.42,0-0.71-0.29Q8,10.43 8,10V8H6V20ZM10,6h4q0-0.82-0.59-1.41T12,4T10.59,4.59Q10,5.18 10,6ZM6,20V8V20Z" /></svg>
                                    <span>Entregar</span>
                                    <span className="ml-auto grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-content">{entregasDeHoje.length}</span>
                                </a>
                            </li>
                            <li>
                                <a href="#historico" onClick={(event) => { event.preventDefault(); void abrirHistorico(); }} className={`flex min-h-12 items-center rounded-xl px-3 py-3 ${tela === "historico" ? "bg-primary/10 font-semibold text-primary" : "text-base-content/70 hover:bg-base-200"}`}>
                                    <svg className="fill-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="#EA3323"><path d="M12,21q-3.45,0-6.01-2.29Q3.43,16.43 3.05,13H5.1q0.35,2.6 2.31,4.3T12,19q2.93,0 4.96-2.04Q19,14.93 19,12q0-2.93-2.04-4.96T12,5Q10.28,5 8.78,5.8T6.25,8H9v2H3V4H5V6.35q1.28-1.6 3.11-2.47T12,3q1.88,0 3.51,0.71t2.85,1.93t1.93,2.85T21,12t-0.71,3.51t-1.93,2.85t-2.85,1.93T12,21Zm2.8-4.8L11,12.4V7h2v4.6l3.2,3.2l-1.4,1.4Z" /></svg>
                                    <span>Histórico</span>
                                    <svg className="ml-auto size-[18px] opacity-50" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9.29 6.71 1.42-1.42L16.42 11a1.4 1.4 0 0 1 0 2l-5.71 5.71-1.42-1.42L13.59 12 9.29 6.71Z" /></svg>
                                </a>
                            </li>
                        </ul>

                        <p className="mt-8 px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-base-content/45">Sistema</p>
                        <ul className="menu gap-1.5 p-0">
                            <li>
                                <a href="#configuracoes" onClick={(event) => { event.preventDefault(); mudarTela("configuracoes"); }} className={`flex min-h-12 items-center rounded-xl px-3 py-3 ${tela === "configuracoes" ? "bg-primary/10 font-semibold text-primary" : "text-base-content/70 hover:bg-base-200"}`}>
                                    <svg className="fill-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="#EA3323"><path d="M9.25,22l-0.4-3.2q-0.32-0.13-0.61-0.3T7.68,18.13L4.7,19.38L1.95,14.63l2.58-1.95Q4.5,12.5 4.5,12.34q0-0.16 0-0.34t0-0.34t0.03-0.34L1.95,9.38L4.7,4.63L7.68,5.88Q7.95,5.68 8.25,5.5t0.6-0.3L9.25,2h5.5l0.4,3.2q0.33,0.13 0.61,0.3t0.56,0.38L19.3,4.63l2.75,4.75l-2.57,1.95q0.02,0.18 0.02,0.34t0,0.34t0,0.34t-0.05,0.34l2.57,1.95l-2.75,4.75l-2.95-1.25q-0.27,0.2-0.57,0.38t-0.6,0.3L14.75,22H9.25ZM11,20h1.98l0.35-2.65q0.78-0.2 1.44-0.59t1.21-0.94l2.47,1.03l0.98-1.7l-2.15-1.63q0.13-0.35 0.17-0.74T17.5,12t-0.05-0.79q-0.05-0.39-0.17-0.74l2.15-1.63l-0.98-1.7L15.98,8.2q-0.55-0.57-1.21-0.96T13.33,6.65L13,4H11.03L10.68,6.65Q9.9,6.85 9.24,7.24T8.03,8.17L5.55,7.15L4.58,8.85l2.15,1.6Q6.6,10.83 6.55,11.2T6.5,12q0,0.4 0.05,0.77t0.17,0.75L4.58,15.15l0.98,1.7L8.03,15.8q0.55,0.58 1.21,0.96t1.44,0.59L11,20Zm1.05-4.5q1.45,0 2.47-1.03T15.55,12T14.53,9.52T12.05,8.5q-1.47,0-2.49,1.02T8.55,12t1.01,2.47t2.49,1.03ZM12,12Z" /></svg>
                                    <span>Configurações</span>
                                    <svg className="ml-auto size-[18px] opacity-50" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9.29 6.71 1.42-1.42L16.42 11a1.4 1.4 0 0 1 0 2l-5.71 5.71-1.42-1.42L13.59 12 9.29 6.71Z" /></svg>
                                </a>
                            </li>
                        </ul>
                    </nav>

                    <div className="mt-6 rounded-2xl border border-base-300 bg-base-200/60 p-4 text-xs text-base-content/60">
                        <div className="flex items-center gap-2 text-success">
                            <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 4H5c-1.1 0-2 .9-2 2v2h18V6c0-1.1-.9-2-2-2ZM3 10v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-8H3Zm4 7H5v-2h2v2Zm0-3H5v-2h2v2Zm3 3H8v-2h2v2Zm0-3H8v-2h2v2Z" /></svg>
                            <p className="font-semibold text-base-content">Caixa de Expedição</p>
                        </div>
                        <p className="mt-2 leading-relaxed">Panificadora Conde LTDA - Matriz</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
