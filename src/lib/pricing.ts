import { supabase } from './supabase';

export type QuoteInput = {
  tipoServico: 'regular' | 'deep' | 'move_in_out';
  frequencia?: 'semanal' | 'quinzenal' | 'mensal';
  sf: number;
  pets: number;
  criancas: number;
  primeiraVisitaRegularSemDeep: boolean;
  addons: {
    forno?: boolean;
    geladeira?: boolean;
    janelasInternas?: number;
    janelasExternas?: number;
    rodapes?: boolean;
    lustres?: number;
    armarios?: number;
    areaExterna?: 'pequena' | 'media' | 'grande' | null;
  };
};

export type CarpetInput = {
  quartoCarpete: number;
  salaCarpete: number;
  corredor: number;
  escada1Lance: number;
  escada2Lances: number;
  tapetePequeno: number;
  tapeteMedio: number;
  tapeteGrande: number;
  sofa2Lugares: number;
  sofa3Lugares: number;
  sofaSectional: number;
  cadeiras: number;
  poltronas: number;
  colchaoTwin: number;
  colchaoQueen: number;
  colchaoKing: number;
};

export async function getRegras(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('regras_precificacao')
    .select('chave, valor');

  if (error || !data) {
    throw new Error('Não foi possível carregar as regras de preço');
  }

  const regras: Record<string, number> = {};
  data.forEach((r) => {
    regras[r.chave] = Number(r.valor);
  });
  return regras;
}

export async function calcularOrcamento(input: QuoteInput) {
  const r = await getRegras();

  let precoSf = 0;
  if (input.tipoServico === 'regular') {
    precoSf =
      input.frequencia === 'semanal'
        ? r.regular_semanal_sf
        : input.frequencia === 'mensal'
        ? r.regular_mensal_sf
        : r.regular_quinzenal_sf;
  } else if (input.tipoServico === 'deep') {
    precoSf = r.deep_cleaning_sf;
  } else if (input.tipoServico === 'move_in_out') {
    precoSf = r.move_in_out_sf;
  }

  let total = input.sf * precoSf;

  if (input.sf < r.minimo_sf_limite && total < r.minimo_geral) {
    total = r.minimo_geral;
  }

  if (input.tipoServico === 'regular' && input.primeiraVisitaRegularSemDeep) {
    total += r.taxa_primeira_visita;
  }

  if (input.tipoServico !== 'move_in_out') {
    if (input.pets === 1) total += r.pet_1;
    else if (input.pets === 2) total += r.pet_2;
    else if (input.pets >= 3) total += r.pet_3;

    if (input.criancas === 1) total += r.crianca_1;
    else if (input.criancas === 2) total += r.crianca_2;
    else if (input.criancas === 3) total += r.crianca_3;
    else if (input.criancas >= 4) total += r.crianca_4mais;
  }

  const a = input.addons;
  if (a.forno && a.geladeira) {
    total += r.addon_forno_geladeira;
  } else {
    if (a.forno) total += r.addon_forno;
    if (a.geladeira) total += r.addon_geladeira;
  }
  if (a.janelasInternas) total += a.janelasInternas * r.addon_janela_interna;
  if (a.janelasExternas) total += a.janelasExternas * r.addon_janela_externa;
  if (a.lustres) total += a.lustres * r.addon_lustre;
  if (a.armarios) total += a.armarios * r.addon_armario_porta;

  if (a.areaExterna === 'pequena') total += r.addon_area_externa_pequena;
  else if (a.areaExterna === 'media') total += r.addon_area_externa_media;
  else if (a.areaExterna === 'grande') total += r.addon_area_externa_grande;

  return Math.round(total * 100) / 100;
}

export async function calcularCarpeteEstofados(input: CarpetInput) {
  const r = await getRegras();

  let total = 0;
  total += input.quartoCarpete * r.carpete_quarto;
  total += input.salaCarpete * r.carpete_sala;
  total += input.corredor * r.carpete_corredor;
  total += input.escada1Lance * r.carpete_escada_1lance;
  total += input.escada2Lances * r.carpete_escada_2lances;
  total += input.tapetePequeno * r.carpete_tapete_pequeno;
  total += input.tapeteMedio * r.carpete_tapete_medio;
  total += input.tapeteGrande * r.carpete_tapete_grande;
  total += input.sofa2Lugares * r.estofado_sofa_2lugares;
  total += input.sofa3Lugares * r.estofado_sofa_3lugares;
  total += input.sofaSectional * r.estofado_sofa_sectional;
  total += input.cadeiras * r.estofado_cadeira;
  total += input.poltronas * r.estofado_poltrona;
  total += input.colchaoTwin * r.estofado_colchao_twin;
  total += input.colchaoQueen * r.estofado_colchao_queen;
  total += input.colchaoKing * r.estofado_colchao_king;

  return Math.round(total * 100) / 100;
}