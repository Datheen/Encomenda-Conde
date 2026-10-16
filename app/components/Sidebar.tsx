"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import EncomendaA4 from "./EncomendaA4";
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

const cores = ["Tradicional", "Vermelho", "Verde", "Azul", "Amarelo"];
const quantidades = Array.from({ length: 20 }, (_, index) => index + 1);
const coresAcento = [
    { nome: "Azul", valor: "#2563eb" },
    { nome: "Verde", valor: "#16a34a" },
    { nome: "Vermelho", valor: "#dc2626" },
    { nome: "Roxo", valor: "#9333ea" },
] as const;

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
    const [tela, setTela] = useState<"inicio" | "historico" | "configuracoes">("inicio");
    const [historico, setHistorico] = useState<HistoricoPedido[]>([]);
    const [salvandoPedido, setSalvandoPedido] = useState(false);
    const [pedidoSalvo, setPedidoSalvo] = useState(false);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [temaEscuro, setTemaEscuro] = useState(false);
    const [salvamentoAutomatico, setSalvamentoAutomatico] = useState(true);
    const [corAcento, setCorAcento] = useState("#dc2626");

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const temaSalvo = window.localStorage.getItem("brioches-tema") === "escuro";
            const salvamentoSalvo = window.localStorage.getItem("brioches-salvamento") !== "desativado";
            const corSalva = window.localStorage.getItem("brioches-cor-acento") || "#dc2626";
            setTemaEscuro(temaSalvo);
            setSalvamentoAutomatico(salvamentoSalvo);
            setCorAcento(corSalva);
            document.documentElement.dataset.theme = temaSalvo ? "brioches-dark" : "brioches-light";
            document.documentElement.style.setProperty("--color-primary", corSalva);
            document.documentElement.style.setProperty("--color-primary-content", "#ffffff");
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    function alternarTema(escuro: boolean) {
        setTemaEscuro(escuro);
        window.localStorage.setItem("brioches-tema", escuro ? "escuro" : "claro");
        document.documentElement.dataset.theme = escuro ? "brioches-dark" : "brioches-light";
    }

    function alternarSalvamento(ativado: boolean) {
        setSalvamentoAutomatico(ativado);
        window.localStorage.setItem("brioches-salvamento", ativado ? "ativado" : "desativado");
    }

    function alterarCorAcento(cor: string) {
        setCorAcento(cor);
        window.localStorage.setItem("brioches-cor-acento", cor);
        document.documentElement.style.setProperty("--color-primary", cor);
        document.documentElement.style.setProperty("--color-primary-content", "#ffffff");
    }

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
    }

    async function salvarPedido(): Promise<boolean> {
        setMensagem("");

        if (pedidoSalvo) {
            return true;
        }

        if (!cliente.trim() || !dataEntrega || !solicitante.trim() || itens.length === 0) {
            setMensagem("Preencha cliente, data de entrega, solicitante e adicione pelo menos um item.");
            return false;
        }

        setSalvandoPedido(true);

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
            setSalvandoPedido(false);
            setMensagem(`Não foi possível salvar a encomenda: ${erroEncomenda?.message || "resposta inválida"}`);
            return false;
        }

        const { error: erroItens } = await supabase.from("itens_encomenda").insert(
            itens.map((item) => ({
                encomenda_id: encomenda.id,
                codigo: item.codigo,
                quantidade: item.pacotes,
                unidade: item.unidades,
                gergelim: item.gergelim,
                aro: item.aro,
                cor: item.cor,
            })),
        );

        if (erroItens) {
            await supabase.from("encomendas").delete().eq("id", encomenda.id);
            setSalvandoPedido(false);
            setMensagem(`A encomenda não foi concluída: ${erroItens.message}`);
            return false;
        }

        setSalvandoPedido(false);
        setPedidoSalvo(true);
        setMensagem("Encomenda salva com sucesso.");
        return true;
    }

    async function abrirHistorico() {
        setTela("historico");
        setMensagem("");
        setCarregandoHistorico(true);

        const { data, error } = await supabase
            .from("encomendas")
            .select("id, cliente_lanche, data_entrega, solicitante, observacao, created_at")
            .order("created_at", { ascending: false });

        setCarregandoHistorico(false);

        if (error) {
            setMensagem(`Não foi possível carregar o histórico: ${error.message}`);
            return;
        }

        setHistorico(data || []);
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

        setHistorico((pedidosAtuais) => pedidosAtuais.filter((pedidoAtual) => pedidoAtual.id !== pedido.id));
        setMensagem("Encomenda apagada com sucesso.");
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
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 6V4h6v2m-9 0 1 14h10l1-14M10 10v6m4-6v6" />
                                </svg>
                                <span className="hidden sm:inline">Limpar tudo</span>
                            </button>
                        </div>

                        <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm lg:p-7">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                                    <span className="text-sm font-bold">01</span>
                                </div>
                                <div>
                                    <h2 className="font-bold">Dados da encomenda</h2>
                                    <p className="text-xs text-base-content/60">Informações para identificação e entrega</p>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <label className="form-control lg:col-span-2">
                                    <span className="label-text mb-2 text-sm font-medium">Cliente / Lanche</span>
                                    <input value={cliente} onChange={(event) => setCliente(event.target.value)} type="text" placeholder="Ex.: Lanche do Alvorada" className="input input-bordered w-full" />
                                </label>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Data de entrega</span>
                                    <input value={dataEntrega} onChange={(event) => setDataEntrega(event.target.value)} type="date" className="input input-bordered w-full" />
                                </label>
                                <label className="form-control">
                                    <span className="label-text mb-2 text-sm font-medium">Solicitante</span>
                                    <input value={solicitante} onChange={(event) => setSolicitante(event.target.value)} type="text" placeholder="Nome do solicitante" className="input input-bordered w-full" />
                                </label>
                                <label className="form-control md:col-span-2">
                                    <span className="label-text mb-2 text-sm font-medium">Observação <span className="font-normal text-base-content/50">(opcional)</span></span>
                                    <input value={observacao} onChange={(event) => setObservacao(event.target.value)} type="text" placeholder="Alguma informação importante sobre a entrega" className="input input-bordered w-full" />
                                </label>
                            </div>
                        </section>

                        <section className="mt-5 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm lg:p-7">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="grid size-9 place-items-center rounded-lg bg-secondary/10 text-secondary">
                                    <span className="text-sm font-bold">02</span>
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
                                <p className="mt-1 text-sm text-base-content/60">Gere o PDF A4 com os dados preenchidos acima.</p>
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
                                onSalvar={salvamentoAutomatico ? salvarPedido : undefined}
                            />
                            <div className="mt-6 flex flex-col items-end gap-3 border-t border-base-300 pt-5">
                                {mensagem && <p className={`w-full text-sm ${mensagem.includes("sucesso") ? "text-success" : "text-error"}`}>{mensagem}</p>}
                                <button type="button" onClick={() => void salvarPedido()} disabled={salvandoPedido || pedidoSalvo} className="btn btn-secondary">
                                    {salvandoPedido ? "Salvando..." : pedidoSalvo ? "Encomenda salva" : "Salvar encomenda"}
                                </button>
                            </div>
                        </div>
                    </div>}

                    {tela === "historico" && (
                        <div className="mx-auto max-w-6xl">
                            <div className="mb-8 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Pedidos salvos</p>
                                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-base-content">Histórico</h1>
                                    <p className="mt-2 text-sm text-base-content/60">Consulte as encomendas registradas no Supabase.</p>
                                </div>
                                <button type="button" onClick={() => void abrirHistorico()} className="btn btn-outline btn-sm">Atualizar</button>
                            </div>

                            {mensagem && <p className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">{mensagem}</p>}
                            <div className="overflow-x-auto rounded-2xl border border-base-300 bg-base-100 shadow-sm">
                                {carregandoHistorico ? (
                                    <div className="p-8 text-center text-sm text-base-content/60">Carregando histórico...</div>
                                ) : historico.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-base-content/60">Nenhuma encomenda salva.</div>
                                ) : (
                                    <table className="table">
                                        <thead><tr><th>Cliente / Lanche</th><th>Entrega</th><th>Solicitante</th><th>Criado em</th><th>Ações</th></tr></thead>
                                        <tbody>{historico.map((pedido) => <tr key={pedido.id}><td className="font-semibold">{pedido.cliente_lanche}</td><td>{pedido.data_entrega}</td><td>{pedido.solicitante}</td><td>{new Date(pedido.created_at).toLocaleString("pt-BR")}</td><td><button type="button" onClick={() => void removerPedido(pedido)} className="btn btn-ghost btn-xs text-error" aria-label={`Apagar encomenda de ${pedido.cliente_lanche}`}>Apagar</button></td></tr>)}</tbody>
                                    </table>
                                )}
                            </div>
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

                                <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-base-300 py-5">
                                    <span>
                                        <span className="block font-medium">Salvar automaticamente</span>
                                        <span className="mt-1 block text-sm text-base-content/60">Salva a encomenda no histórico antes de gerar o PDF.</span>
                                    </span>
                                    <input type="checkbox" className="toggle toggle-primary" checked={salvamentoAutomatico} onChange={(event) => alternarSalvamento(event.target.checked)} />
                                </label>
                            </section>
                        </div>
                    )}
                </main>
            </div>

            <div className="drawer-side">
                <label htmlFor="navigation-drawer" aria-label="Fechar navegação" className="drawer-overlay" />
                <aside className="flex min-h-full w-72 flex-col border-r border-base-300 bg-base-100 p-4 text-base-content">
                    <div className="flex items-center gap-3 border-b border-base-300 px-2 pb-5 pt-2">
                        <div id="logo" className="grid size-10 place-items-center overflow-hidden text-primary-content shadow-sm">
                            <Image src="/favicon.ico" alt="Logo Conde do Pão" width={40} height={40} className="size-full object-cover" />
                        </div>
                        <div>
                            <p className="font-bold leading-tight">Conde do Pão</p>
                            <p className="text-xs text-base-content/60">Pedido de Brioches</p>
                        </div>
                    </div>

                    <nav className="mt-6 flex-1" aria-label="Navegação principal">
                        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-base-content/50">
                            Menu principal
                        </p>
                        <ul className="menu gap-2 p-0">
                            <li>
                                <Link href="/" onClick={() => setTela("inicio")} className="active:bg-primary active:text-primary-content">
                                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="size-6 text-primary" fill="currentColor" aria-hidden="true"><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg>
                                    <span>Início</span>
                                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Encomendas</span>
                                </Link>
                            </li>
                            <li>
                                <a href="#historico" onClick={(event) => { event.preventDefault(); void abrirHistorico(); }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="size-6 text-primary" fill="currentColor" aria-hidden="true"><path d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm112-192L440-464v-216h80v184l128 128-56 56Z"/></svg>
                                    <span>Histórico</span>
                                </a>
                            </li>
                            <li>
                                <a href="#configuracoes" onClick={(event) => { event.preventDefault(); setTela("configuracoes"); }}>
                                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="size-6 text-primary" fill="currentColor" aria-hidden="true"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>
                                    <span>Configurações</span>
                                </a>
                            </li>
                        </ul>
                    </nav>

                    <div className="rounded-xl bg-base-200 p-3 text-xs text-base-content/60">
                        <p className="font-semibold text-base-content">Caixa de Expedição</p>
                        <p className="mt-1">Panificadora Conde LTDA - Matriz</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
