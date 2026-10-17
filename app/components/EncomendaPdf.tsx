import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { EncomendaA4Props } from "./EncomendaA4";

const pdfStyles = StyleSheet.create({
  page: {
    paddingVertical: "25.4mm",
    paddingHorizontal: "18mm",
    color: "#000000",
    fontSize: 13,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000000",
    borderStyle: "solid",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    borderStyle: "solid",
    padding: 6,
    justifyContent: "center",
  },
  lastCell: {
    borderRightWidth: 0,
  },
  headerTitle: {
    width: "100%",
    textAlign: "center",
    fontSize: 16,
    fontWeight: 700,
  },
  label: {
    width: "22.115%",
  },
  value: {
    width: "77.885%",
    fontWeight: 700,
  },
  valueShort: {
    width: "38.942%",
    fontWeight: 500,
  },
  requester: {
    width: "38.942%",
  },
  orderTitle: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: 700,
  },
  orderHeader: {
    fontSize: 12,
    fontWeight: 400,
    textAlign: "center",
  },
  orderCell: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  colCode: { width: "12.346%" },
  colQuantity: { width: "19.865%" },
  colUnit: { width: "10.423%" },
  colSesame: { width: "25.798%" },
  colHoop: { width: "9.933%" },
  colColor: { width: "21.635%", borderRightWidth: 0 },
});

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

function EncomendaPdf({
  clienteLanche,
  dataEntrega,
  solicitante,
  dataSolicitada,
  observacao,
  itens,
}: EncomendaA4Props & { dataSolicitada: string }) {
  return (
    <Document>
      <Page size={[595.28, 841.89]} orientation="portrait" style={pdfStyles.page}>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.cell, { width: "100%", borderRightWidth: 0 }]}><Text wrap={false} style={pdfStyles.headerTitle}>ENCOMENDA DE PÃO BRIOCHE - CAIXA EXPEDIÇÃO</Text></View>
          </View>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.cell, pdfStyles.label]}><Text wrap={false}>Cliente/Lanche:</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.value, pdfStyles.lastCell]}><Text wrap={false}>{clienteLanche}</Text></View>
          </View>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.cell, pdfStyles.label]}><Text wrap={false}>Data de entrega:</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.value, pdfStyles.lastCell]}><Text wrap={false}>{formatarDataComDia(dataEntrega)}</Text></View>
          </View>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.cell, pdfStyles.label]}><Text wrap={false}>Solicitante:</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.requester]}><Text wrap={false}>{solicitante}</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.valueShort, pdfStyles.lastCell]}><Text wrap={false}>Data solicitada: {formatarData(dataSolicitada)}</Text></View>
          </View>
          <View style={[pdfStyles.row, { minHeight: 56 }]}>
            <View style={[pdfStyles.cell, pdfStyles.label, { borderBottomWidth: 0 }]}><Text wrap={false}>Observação:</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.value, pdfStyles.lastCell, { borderBottomWidth: 0 }]}><Text wrap={false}>{observacao}</Text></View>
          </View>
        </View>

        <View style={[pdfStyles.table, { marginTop: 16 }]}>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.cell, { width: "100%", borderRightWidth: 0 }]}><Text wrap={false} style={pdfStyles.orderTitle}>PEDIDOS</Text></View>
          </View>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.cell, pdfStyles.colCode]}><Text wrap={false} style={pdfStyles.orderHeader}>Cod.</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.colQuantity]}><Text wrap={false} style={pdfStyles.orderHeader}>Quantidade</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.colUnit]}><Text wrap={false} style={pdfStyles.orderHeader}>Und</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.colSesame]}><Text wrap={false} style={pdfStyles.orderHeader}>Com/Sem Gergelim</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.colHoop]}><Text wrap={false} style={pdfStyles.orderHeader}>Aro</Text></View>
            <View style={[pdfStyles.cell, pdfStyles.colColor]}><Text wrap={false} style={pdfStyles.orderHeader}>Cor</Text></View>
          </View>
          {itens.map((item, index) => (
            <View style={pdfStyles.row} key={`${item.codigo}-${index}`} wrap={false}>
              <View style={[pdfStyles.cell, pdfStyles.colCode]}><Text wrap={false} style={pdfStyles.orderCell}>{item.codigo}</Text></View>
              <View style={[pdfStyles.cell, pdfStyles.colQuantity]}><Text wrap={false} style={pdfStyles.orderCell}>{item.quantidade} {item.quantidade === 1 ? "PACOTE" : "PACOTES"}</Text></View>
              <View style={[pdfStyles.cell, pdfStyles.colUnit]}><Text wrap={false} style={pdfStyles.orderCell}>{item.unidade}</Text></View>
              <View style={[pdfStyles.cell, pdfStyles.colSesame]}><Text wrap={false} style={pdfStyles.orderCell}>{item.gergelim ? "COM GERGELIM" : "SEM GERGELIM"}</Text></View>
              <View style={[pdfStyles.cell, pdfStyles.colHoop]}><Text wrap={false} style={pdfStyles.orderCell}>{item.aro}</Text></View>
              <View style={[pdfStyles.cell, pdfStyles.colColor]}><Text wrap={false} style={pdfStyles.orderCell}>{item.cor.toUpperCase()}</Text></View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export function gerarEncomendaPdf(props: EncomendaA4Props & { dataSolicitada: string }) {
  return pdf(<EncomendaPdf {...props} />).toBlob();
}
