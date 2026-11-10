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
    if (salvando) return;

    setSalvando(true);
    setErroPdf("");
    const janelaImpressao = window.open("", "_blank");

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
      if (janelaImpressao) {
        janelaImpressao.document.title = "Imprimir encomenda";
        janelaImpressao.onload = () => {
          janelaImpressao.focus();
          janelaImpressao.print();
        };
        janelaImpressao.location.href = url;
      }
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
        {salvando ? "Gerando PDF..." : "Salvar e imprimir"}
      </button>
      {erroPdf && <p className="text-sm text-error print:hidden">{erroPdf}</p>}
    </section>
  );
}
