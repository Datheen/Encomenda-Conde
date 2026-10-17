"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type EncomendaA4Item = {
  codigo: string;
  quantidade: number;
  unidade: number;
  gergelim: boolean;
  aro: "60" | "80" | string;
  cor: string;
};

export type EncomendaA4Props = {
  clienteLanche: string;
  dataEntrega: string;
  solicitante: string;
  observacao?: string;
  itens: EncomendaA4Item[];
  onSalvar?: () => Promise<boolean>;
  dataSolicitada?: string;
  baixarAutomaticamente?: boolean;
};

function formatarData(data: string) {
  if (!data) return "";

  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function formatarDataComDia(data: string) {
  if (!data) return "";

  const dataFormatada = formatarData(data);
  const diaDaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(
    new Date(`${data}T12:00:00`),
  );

  return `${dataFormatada} (${diaDaSemana.toUpperCase()})`;
}

export default function EncomendaA4({
  clienteLanche,
  dataEntrega,
  solicitante,
  observacao,
  itens,
  onSalvar,
  dataSolicitada: dataSolicitadaProp,
  baixarAutomaticamente = false,
}: EncomendaA4Props) {
  const folhaRef = useRef<HTMLElement>(null);
  const autoDownloadStarted = useRef(false);
  const [salvando, setSalvando] = useState(false);
  const [erroPdf, setErroPdf] = useState("");
  const [dataSolicitada, setDataSolicitada] = useState(dataSolicitadaProp || "");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDataSolicitada(dataSolicitadaProp || new Date().toISOString().slice(0, 10));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [dataSolicitadaProp]);

  const salvarEmPdf = useCallback(async () => {
    if (!folhaRef.current || salvando) return;

    setSalvando(true);
    setErroPdf("");
    document.querySelectorAll(".html2pdf__overlay").forEach((overlay) => overlay.remove());

    try {
      const salvamento = onSalvar
        ? onSalvar().catch(() => false)
        : Promise.resolve(true);

      const nomeCliente = (clienteLanche || "cliente")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
      const dataArquivo = dataEntrega || new Date().toISOString().slice(0, 10);
      const { gerarEncomendaPdf } = await import("./EncomendaPdf");
      const arquivoPdf = await gerarEncomendaPdf({
        clienteLanche,
        dataEntrega,
        solicitante,
        dataSolicitada,
        observacao,
        itens,
      });
      const url = URL.createObjectURL(arquivoPdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `encomenda-${nomeCliente || "cliente"}-${dataArquivo}.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 1000);

      if (!(await salvamento)) {
        setErroPdf("PDF salvo, mas não foi possível registrar a encomenda no histórico.");
      }
    } catch (error) {
      console.error("Falha ao gerar o PDF da encomenda", error);
      setErroPdf("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }, [clienteLanche, dataEntrega, dataSolicitada, itens, observacao, onSalvar, salvando, solicitante]);

  useEffect(() => {
    if (baixarAutomaticamente && dataSolicitada && !autoDownloadStarted.current) {
      autoDownloadStarted.current = true;
      void salvarEmPdf();
    }
  }, [baixarAutomaticamente, dataSolicitada, salvarEmPdf]);

  return (
    <section className="print-area flex flex-col items-center gap-4">
      <button type="button" onClick={salvarEmPdf} disabled={salvando} className="btn btn-primary print:hidden">
        {salvando ? "Gerando PDF..." : "Salvar em PDF"}
      </button>
      {erroPdf && <p className="text-sm text-error print:hidden">{erroPdf}</p>}

      <article ref={folhaRef} className="a4-sheet box-border h-[297mm] w-[210mm] overflow-hidden bg-white px-[18mm] py-[25.4mm] text-black print:m-0 print:shadow-none">
        <table className="w-full border-collapse border border-black text-[14px] leading-tight">
          <colgroup>
            <col className="w-[22.115%]" />
            <col className="w-[38.942%]" />
            <col className="w-[38.942%]" />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={3} className="border border-black px-3.5 py-3.5 text-center align-middle text-[16px] font-bold whitespace-nowrap">
                ENCOMENDA DE PÃO BRIOCHE - CAIXA EXPEDIÇÃO
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3.5 py-3.5 align-middle whitespace-nowrap">Cliente/Lanche:</td>
              <td colSpan={2} className="border border-black px-3.5 py-3.5 align-middle font-bold whitespace-nowrap">{clienteLanche}</td>
            </tr>
            <tr>
              <td className="border border-black px-3.5 py-3.5 align-middle whitespace-nowrap">Data de entrega:</td>
              <td colSpan={2} className="border border-black px-3.5 py-3.5 align-middle font-bold whitespace-nowrap">{formatarDataComDia(dataEntrega)}</td>
            </tr>
            <tr>
              <td className="border border-black px-3.5 py-3.5 align-middle">Solicitante:</td>
              <td className="border border-black px-3.5 py-3.5 align-middle font-medium">{solicitante}</td>
              <td className="border border-black px-3.5 py-3.5 align-middle">Data solicitada: <span className="font-medium">{formatarData(dataSolicitada)}</span></td>
            </tr>
            <tr>
              <td className="border border-black px-3.5 py-3.5 align-middle">Observação:</td>
              <td colSpan={2} className="h-16 border border-black px-3.5 py-3.5 align-middle font-medium">{observacao}</td>
            </tr>
          </tbody>
        </table>

        <table className="mt-6 w-full border-collapse border border-black text-[12px] leading-tight">
          <colgroup>
            <col className="w-[12.346%]" />
            <col className="w-[19.865%]" />
            <col className="w-[10.423%]" />
            <col className="w-[25.798%]" />
            <col className="w-[9.933%]" />
            <col className="w-[21.635%]" />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={6} className="border border-black px-2.5 py-2.5 text-center align-middle text-[15px] font-bold">PEDIDOS</th>
            </tr>
            <tr>
              <th className="border border-black px-2.5 py-2.5 text-center align-middle text-[12px] font-normal whitespace-nowrap">Cod.</th>
              <th className="border border-black px-2.5 py-2.5 text-center align-middle text-[12px] font-normal whitespace-nowrap">Quantidade</th>
              <th className="border border-black px-2.5 py-2.5 text-center align-middle text-[12px] font-normal whitespace-nowrap">Und</th>
              <th className="border border-black px-2.5 py-2.5 text-center align-middle text-[12px] font-normal whitespace-nowrap">Com/Sem Gergelim</th>
              <th className="border border-black px-2.5 py-2.5 text-center align-middle text-[12px] font-normal whitespace-nowrap">Aro</th>
              <th className="border border-black px-2.5 py-2.5 text-center align-middle text-[12px] font-normal whitespace-nowrap">Cor</th>
            </tr>
          </thead>
          <tbody>
            {itens.length > 0 ? itens.map((item, index) => (
              <tr key={`${item.codigo}-${index}`}>
                <td className="border border-black px-2.5 py-2.5 text-center align-middle font-bold whitespace-nowrap">{item.codigo}</td>
                <td className="border border-black px-2.5 py-2.5 text-center align-middle font-bold whitespace-nowrap">{item.quantidade} {item.quantidade === 1 ? "PACOTE" : "PACOTES"}</td>
                <td className="border border-black px-2.5 py-2.5 text-center align-middle font-bold whitespace-nowrap">{item.unidade}</td>
                <td className="border border-black px-2.5 py-2.5 text-center align-middle font-bold whitespace-nowrap">{item.gergelim ? "COM GERGELIM" : "SEM GERGELIM"}</td>
                <td className="border border-black px-2.5 py-2.5 text-center align-middle font-bold whitespace-nowrap">{item.aro}</td>
                <td className="border border-black px-2.5 py-2.5 text-center align-middle font-bold uppercase whitespace-nowrap">{item.cor}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="border border-black px-2.5 py-7 text-center align-middle">Nenhum pedido informado</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}
