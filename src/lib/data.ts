// Catálogo completo de crimes do Código Penal / OFFSET RP

export interface Crime {
  nome: string;
  categoria: string;
  multa: number;
  meses: number;
  observacoes?: string;
}

export const CRIMES_CATALOGO: Crime[] = [
  // ========== LEI 01/2022 - CRIMES RODOVIÁRIOS ==========
  { nome: "Abandono de Veículo", categoria: "Crimes Rodoviários", multa: 4500, meses: 0, observacoes: "Quando um cidadão deixa deliberadamente a sua viatura na via pública ou num local impróprio para a permanência da mesma" },
  { nome: "Alterações Estéticas Ilegais", categoria: "Crimes Rodoviários", multa: 12000, meses: 0, observacoes: "Veículo que seja detentor de modificações estéticas ilegais" },
  { nome: "Andar sem Capacete", categoria: "Crimes Rodoviários", multa: 1500, meses: 0, observacoes: "Condução sem proteção pessoal - aplicável ao condutor e passageiros" },
  { nome: "Condução Imprudent", categoria: "Crimes Rodoviários", multa: 7000, meses: 0, observacoes: "Condução que viola grosseiramente ou sistematicamente as regras da circulação rodoviária" },
  { nome: "Conduzir sem Luzes", categoria: "Crimes Rodoviários", multa: 1500, meses: 0, observacoes: "Condução durante a noite ou amanhecer com os faróis desligados" },
  { nome: "Conduzir sem Habilitação", categoria: "Crimes Rodoviários", multa: 10000, meses: 0, observacoes: "Condução de um veículo sem habilitação" },
  { nome: "Corridas Ilegais", categoria: "Crimes Rodoviários", multa: 10500, meses: 0, observacoes: "Ato de fazer corridas fora dos locais adequados" },
  { nome: "Destruição de Património Público", categoria: "Crimes Rodoviários", multa: 1500, meses: 0, observacoes: "Sinais de trânsito +250€, postes eletricidade +500€, bocas incêndio +1000€, propriedades +2000€" },
  { nome: "Dirigir sob Influência de Substâncias", categoria: "Crimes Rodoviários", multa: 3000, meses: 3, observacoes: "Mínimo 0.05g/l, máximo 1.2g/l" },
  { nome: "Estacionar em Local Proibido", categoria: "Crimes Rodoviários", multa: 2500, meses: 0, observacoes: "Estacionar em local sinalizado como proibido ou bloquear acesso" },
  { nome: "Excesso de Ocupantes", categoria: "Crimes Rodoviários", multa: 3750, meses: 0, observacoes: "Por cada ocupante a mais +1500€" },
  { nome: "Excesso de Velocidade", categoria: "Crimes Rodoviários", multa: 3000, meses: 0, observacoes: "Por cada 10km/h acima do limite +1500€ até máximo 10000€" },
  { nome: "Falta de Documentos", categoria: "Crimes Rodoviários", multa: 10000, meses: 0, observacoes: "Cartão cidadão 6000€, carta condução 3000€, porte de arma 10000€" },
  { nome: "Fuga após Causar Acidente", categoria: "Crimes Rodoviários", multa: 7500, meses: 3, observacoes: "Ato de causar ou contribuir para um acidente sem prestar auxílio" },
  { nome: "Modificações Ilegais de Performance", categoria: "Crimes Rodoviários", multa: 11250, meses: 0, observacoes: "Veículo com modificações ilegais de aumento de performance" },
  { nome: "Não Ceder Passagem a Veículo de Emergência", categoria: "Crimes Rodoviários", multa: 1500, meses: 0, observacoes: "Não respeitar sinalização de marcha de emergência" },
  { nome: "Parar Helicóptero/Avião em Local Inadequado", categoria: "Crimes Rodoviários", multa: 20000, meses: 0, observacoes: "Estacionar em local não sinalizado para tal" },
  { nome: "Transporte de Viaturas em Condições Precárias", categoria: "Crimes Rodoviários", multa: 15000, meses: 0, observacoes: "Transportar viaturas em veículos não adequados" },
  { nome: "Ultrapassar Sinal Vermelho/Stop", categoria: "Crimes Rodoviários", multa: 3000, meses: 0, observacoes: "Não parar num STOP ou sinal vermelho" },
  { nome: "Uso de Veículo Furtado", categoria: "Crimes Rodoviários", multa: 10000, meses: 4, observacoes: "Circular num veículo sinalizado como furtado/roubado" },
  { nome: "Utilização de Equipamentos Eletrónicos durante Condução", categoria: "Crimes Rodoviários", multa: 750, meses: 0, observacoes: "Telemóveis, rádios, auscultadores durante condução" },
  { nome: "Veículo em Estado Não Viável", categoria: "Crimes Rodoviários", multa: 3000, meses: 0, observacoes: "Acumula 300€ por peça (para-choques, faróis, portas, capô, bagageira, rodas/pneus)" },
  { nome: "Veículo sem Matrícula", categoria: "Crimes Rodoviários", multa: 15000, meses: 0, observacoes: "Veículo sem matrícula a circular na via pública" },

  // ========== LEI 02/2022 - CRIMES CONTRA O PATRIMÓNIO ==========
  { nome: "Assalto a Casa", categoria: "Crimes contra o Património", multa: 30000, meses: 7, observacoes: "Quem entra dentro de uma residência privada e se apropria de algo alheio" },
  { nome: "Tentativa de Assalto a Casa", categoria: "Crimes contra o Património", multa: 22500, meses: 5, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Assalto a Joalharia", categoria: "Crimes contra o Património", multa: 75000, meses: 20, observacoes: "Assalto a uma joalharia" },
  { nome: "Tentativa de Assalto a Joalharia", categoria: "Crimes contra o Património", multa: 56250, meses: 15, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Assalto a Banco", categoria: "Crimes contra o Património", multa: 150000, meses: 30, observacoes: "Assalto a Banco" },
  { nome: "Tentativa de Assalto a Banco", categoria: "Crimes contra o Património", multa: 112500, meses: 22, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Assalto a Loja", categoria: "Crimes contra o Património", multa: 52500, meses: 15, observacoes: "Assalto a uma loja de conveniência" },
  { nome: "Tentativa de Assalto a Loja", categoria: "Crimes contra o Património", multa: 39375, meses: 11, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Assalto a Contentor", categoria: "Crimes contra o Património", multa: 25000, meses: 5, observacoes: "Assalto a um contentor de mercadorias" },
  { nome: "Tentativa de Assalto a Contentor", categoria: "Crimes contra o Património", multa: 18750, meses: 3, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Assalto a Loja de Armas", categoria: "Crimes contra o Património", multa: 105000, meses: 25, observacoes: "Assalto a uma loja de armas" },
  { nome: "Tentativa de Assalto a Loja de Armas", categoria: "Crimes contra o Património", multa: 78750, meses: 18, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Assalto a Carrinha de Valores", categoria: "Crimes contra o Património", multa: 40000, meses: 10, observacoes: "Assalto a uma carrinha de transporte de valores" },
  { nome: "Tentativa de Assalto a Carrinha de Valores", categoria: "Crimes contra o Património", multa: 30000, meses: 7, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Burla", categoria: "Crimes contra o Património", multa: 20000, meses: 8, observacoes: "Engano propositado com o objetivo de prejudicar alguém financeiramente" },
  { nome: "Tentativa de Burla", categoria: "Crimes contra o Património", multa: 15000, meses: 6, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Furto", categoria: "Crimes contra o Património", multa: 20000, meses: 4, observacoes: "Quem se apropria de algo sem recurso à violência" },
  { nome: "Tentativa de Furto", categoria: "Crimes contra o Património", multa: 15000, meses: 3, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Roubo", categoria: "Crimes contra o Património", multa: 30000, meses: 7, observacoes: "Quem se apropria de algo alheio com recurso à violência ou ameaças" },
  { nome: "Tentativa de Roubo", categoria: "Crimes contra o Património", multa: 22500, meses: 5, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Roubo de Armamento do Estado", categoria: "Crimes contra o Património", multa: 60000, meses: 12, observacoes: "Beretta 92, Laterna, Taser, Cassete, Munições M4, shotgun, SMG, Shotgun borracha, EWB 1911, MP5, G36C, Medikit Polícia, Colete Polícia" },
  { nome: "Tentativa de Roubo de Armamento do Estado", categoria: "Crimes contra o Património", multa: 45000, meses: 9, observacoes: "Tentativa não consumada - 25% redução" },

  // ========== LEI 03/2022 - CRIMES CONTRA O ESTADO ==========
  { nome: "Abuso de Poder", categoria: "Crimes contra o Estado", multa: 0, meses: 0, observacoes: "Determinação da pena pelo juiz" },
  { nome: "Deitar Fora uma Arma de Fogo", categoria: "Crimes contra o Estado", multa: 21000, meses: 5, observacoes: "Desfazer-se de uma arma de fogo sem qualquer razão aparente" },
  { nome: "Desobediência", categoria: "Crimes contra o Estado", multa: 5000, meses: 2, observacoes: "Incumprimento de uma ordem legal estabelecida" },
  { nome: "Desrespeito à Autoridade", categoria: "Crimes contra o Estado", multa: 25000, meses: 5, observacoes: "Quando um cidadão profere palavras desrespeitosas ou comete ato físico contra a autoridade" },
  { nome: "Desrespeito em Tribunal", categoria: "Crimes contra o Estado", multa: 10000, meses: 5, observacoes: "Se impossibilitar a audiência, máximo 70000€" },
  { nome: "Escapar a Custódia", categoria: "Crimes contra o Estado", multa: 20000, meses: 6, observacoes: "Ato de fugir de um agente da segurança pública aquando da sua detenção" },
  { nome: "Exposição Indecente", categoria: "Crimes contra o Estado", multa: 4500, meses: 0, observacoes: "Expor intencionalmente partes íntimas num local público" },
  { nome: "Usurpação de Identidade", categoria: "Crimes contra o Estado", multa: 22500, meses: 2, observacoes: "Uso de documento alheio em prol de benefício próprio" },
  { nome: "Usurpação de Funções", categoria: "Crimes contra o Estado", multa: 10500, meses: 2, observacoes: "Uso de uma identidade profissional que não possui" },
  { nome: "Usurpação de Funções de Funcionário Público", categoria: "Crimes contra o Estado", multa: 35000, meses: 6, observacoes: "Uso da identidade de um funcionário público que não possui" },
  { nome: "Falta de Equipamento de Proteção Individual", categoria: "Crimes contra o Estado", multa: 12500, meses: 0, observacoes: "2500€ por peça em falta (Colete, Capacete, Botas)" },
  { nome: "Fuga ao Fisco", categoria: "Crimes contra o Estado", multa: 70000, meses: 5, observacoes: "Invasão fiscal de impostos cobrados pelo estado (IVA)" },
  { nome: "Fuga às Autoridades", categoria: "Crimes contra o Estado", multa: 50000, meses: 8, observacoes: "Usar veículo ou outra forma para fugir em ato deliberado a um agente da autoridade" },
  { nome: "Invasão de Propriedade Privada Estatal", categoria: "Crimes contra o Estado", multa: 45000, meses: 6, observacoes: "Entrada num local que pertence ao estado e cuja entrada é restrita" },
  { nome: "Obstrução à Identidade", categoria: "Crimes contra o Estado", multa: 10000, meses: 0, observacoes: "Encontrar-se com máscara ou outros objetos que impossibilitem a identificação" },
  { nome: "Obstrução à Justiça", categoria: "Crimes contra o Estado", multa: 15000, meses: 3, observacoes: "Impedir ilegalmente a progressão de uma investigação por ocultação de provas" },
  { nome: "Omissão de Auxílio", categoria: "Crimes contra o Estado", multa: 11250, meses: 6, observacoes: "Não prestar auxílio ou ignorar o estado de saúde de um cidadão" },
  { nome: "Organização de Eventos Ilegais", categoria: "Crimes contra o Estado", multa: 37500, meses: 4, observacoes: "Se houver dinheiro angariado, 50% do valor acresce à coima" },
  { nome: "Peculato", categoria: "Crimes contra o Estado", multa: 70000, meses: 15, observacoes: "Subtração de dinheiro público para proveito próprio por funcionário público" },
  { nome: "Falsidade de Depoimento ou Declaração", categoria: "Crimes contra o Estado", multa: 15000, meses: 2, observacoes: "Prestar falsas declarações depois de ter prestado juramento" },
  { nome: "Poluição Sonora", categoria: "Crimes contra o Estado", multa: 1500, meses: 0, observacoes: "Perturbar a paz e ordem pública, ou violar hora do silêncio (20h às 8h)" },
  { nome: "Pseudocídio", categoria: "Crimes contra o Estado", multa: 12000, meses: 4, observacoes: "Deixar provas que sugerem que está morto com o intuito de enganar outras pessoas" },
  { nome: "Resistência à Ordem de Prisão", categoria: "Crimes contra o Estado", multa: 15000, meses: 5, observacoes: "Tentar impedir ou fugir de uma detenção/prisão" },
  { nome: "Suborno", categoria: "Crimes contra o Estado", multa: 22500, meses: 7, observacoes: "50% do valor oferecido acresce à coima - aplicado a ambos" },
  { nome: "Tentativa de Fuga às Autoridades", categoria: "Crimes contra o Estado", multa: 35000, meses: 4, observacoes: "Tentativa não consumada de escapar à detenção/prisão" },
  { nome: "Tentativa de Suborno", categoria: "Crimes contra o Estado", multa: 15000, meses: 5, observacoes: "25% do valor oferecido acresce - aplicado ao subornador" },
  { nome: "Utilização Abusiva dos Serviços Telefónicos Estatais", categoria: "Crimes contra o Estado", multa: 25000, meses: 3, observacoes: "Utilizar os serviços telefónicos de forma abusiva e/ou desrespeitosa" },
  { nome: "Vandalismo", categoria: "Crimes contra o Estado", multa: 0, meses: 0, observacoes: "Causar danos a propriedades privadas ou públicas - pedido pela acusação" },
  { nome: "Violação de Regra de Segurança", categoria: "Crimes contra o Estado", multa: 150000, meses: 10, observacoes: "Não fornecer informações das regras dos EPIs - empresa/identidade" },
  { nome: "Violação do Sigilo Profissional", categoria: "Crimes contra o Estado", multa: 0, meses: 0, observacoes: "Passar informações do sigilo da sua profissão - determinação pelo juiz" },

  // ========== LEI 04/2022 - CRIMES CONTRA AS PESSOAS ==========
  { nome: "Abusar da Linha de Emergência", categoria: "Crimes contra as Pessoas", multa: 15000, meses: 0, observacoes: "Utilizar a linha 112 várias vezes atrapalhando os serviços de emergência" },
  { nome: "Ameaça", categoria: "Crimes contra as Pessoas", multa: 25000, meses: 8, observacoes: "Dar indício de prejudicar alguém fisicamente ou colocar em perigo iminente" },
  { nome: "Tentativa de Ameaça", categoria: "Crimes contra as Pessoas", multa: 18750, meses: 6, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Assédio", categoria: "Crimes contra as Pessoas", multa: 20000, meses: 6, observacoes: "Proferir palavras de caráter ofensivo, sexual ou provocatório" },
  { nome: "Tentativa de Assédio", categoria: "Crimes contra as Pessoas", multa: 15000, meses: 4, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Criação de Local para Fins de Tortura", categoria: "Crimes contra as Pessoas", multa: 60000, meses: 9, observacoes: "Utilização/Criação de um lugar com a finalidade de torturar alguém" },
  { nome: "Tentativa de Tortura", categoria: "Crimes contra as Pessoas", multa: 67500, meses: 7, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Desacatos", categoria: "Crimes contra as Pessoas", multa: 7500, meses: 2, observacoes: "Qualquer tipo de confusão que leve à perturbação da ordem pública" },
  { nome: "Difamação", categoria: "Crimes contra as Pessoas", multa: 21000, meses: 4, observacoes: "Afirmar ou distribuir factos inverídicos capazes de ofender a credibilidade de uma pessoa" },
  { nome: "Exposição ao Abandono", categoria: "Crimes contra as Pessoas", multa: 35000, meses: 10, observacoes: "Colocar em perigo a vida de outra pessoa, nomeadamente do seu dependente" },
  { nome: "Tentativa de Exposição ao Abandono", categoria: "Crimes contra as Pessoas", multa: 26250, meses: 7, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Extorsão", categoria: "Crimes contra as Pessoas", multa: 22500, meses: 4, observacoes: "Por meio de ameaças ou violência obter algo para benefício próprio" },
  { nome: "Tentativa de Extorsão", categoria: "Crimes contra as Pessoas", multa: 16875, meses: 3, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Injúria", categoria: "Crimes contra as Pessoas", multa: 10500, meses: 0, observacoes: "Imputar factos, mesmo sob forma de suspeita, ou dirigir palavras ofensivas" },
  { nome: "Invasão de Propriedade Privada", categoria: "Crimes contra as Pessoas", multa: 30000, meses: 6, observacoes: "Entrada num local devidamente assinado como restrito ou proibido" },
  { nome: "Tentativa de Invasão de Propriedade Privada", categoria: "Crimes contra as Pessoas", multa: 22500, meses: 4, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Negligência", categoria: "Crimes contra as Pessoas", multa: 30000, meses: 0, observacoes: "15k€ a 30k€ - Falta de cuidado e/ou erro de aplicação de medidas de segurança" },
  { nome: "Ofensa à Integridade Física Grave", categoria: "Crimes contra as Pessoas", multa: 15000, meses: 6, observacoes: "Privar alguém de importante órgão ou membro, desfigurando-o gravemente" },
  { nome: "Tentativa de Ofensa à Integridade Física Grave", categoria: "Crimes contra as Pessoas", multa: 11250, meses: 4, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Ofensa à Integridade Física Simples", categoria: "Crimes contra as Pessoas", multa: 10500, meses: 6, observacoes: "Ofender o corpo ou a saúde doutra pessoa" },
  { nome: "Tentativa de Ofensa à Integridade Física Simples", categoria: "Crimes contra as Pessoas", multa: 7875, meses: 4, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Responsabilidade Danosa", categoria: "Crimes contra as Pessoas", multa: 0, meses: 0, observacoes: "Determinação da pena pelo juiz - Violação ilícita com dolo ou negligência" },
  { nome: "Violência Doméstica", categoria: "Crimes contra as Pessoas", multa: 45000, meses: 13, observacoes: "Comportamento agressivo ou violento dentro de um agregado familiar" },
  { nome: "Tentativa de Violência Doméstica", categoria: "Crimes contra as Pessoas", multa: 33750, meses: 9, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Sequestro", categoria: "Crimes contra as Pessoas", multa: 30000, meses: 8, observacoes: "Por cada refém acresce 9000€ - Funcionário público +15000€" },
  { nome: "Tentativa de Sequestro", categoria: "Crimes contra as Pessoas", multa: 22500, meses: 6, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Tortura", categoria: "Crimes contra as Pessoas", multa: 90000, meses: 10, observacoes: "Torturar física ou psicologicamente para obtenção de informações, bens ou serviços" },

  // ========== LEI 05/2022 - CRIMES GRAVES ==========
  { nome: "Assalto ao Porta-Aviões", categoria: "Crimes Graves", multa: 400000, meses: 30, observacoes: "Não pode ser acumulado com outras penas" },
  { nome: "Tentativa de Assalto ao Porta-Aviões", categoria: "Crimes Graves", multa: 300000, meses: 22, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Atividade Terroristas", categoria: "Crimes Graves", multa: 200000, meses: 20, observacoes: "Crimes e atos que vulnerabilizem e coloquem em perigo a segurança nacional" },
  { nome: "Tentativa de Atividade Terroristas", categoria: "Crimes Graves", multa: 150000, meses: 15, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Compra e Venda de Armas", categoria: "Crimes Graves", multa: 100000, meses: 13, observacoes: "Ato de comprar/vender qualquer tipo de arma a alguém sem aptidão legal" },
  { nome: "Compra de Licenças", categoria: "Crimes Graves", multa: 5500, meses: 3, observacoes: "Quem adquire licenças/documentos por outros meios" },
  { nome: "Compra e Venda de Medickits", categoria: "Crimes Graves", multa: 45000, meses: 10, observacoes: "Ato de comprar/vender ou revender medickits" },
  { nome: "Corrupção", categoria: "Crimes Graves", multa: 0, meses: 0, observacoes: "Determinação da pena pelo juiz - Aceitar um suborno" },
  { nome: "Cúmplice", categoria: "Crimes Graves", multa: 0, meses: 0, observacoes: "Determinação da pena pelo juiz - Quem colabora ou não nada faz para impedir acontecimento ilegal" },
  { nome: "Exibição de Arma Branca", categoria: "Crimes Graves", multa: 11500, meses: 0, observacoes: "Exibir qualquer arma branca na presença de qualquer outra pessoa" },
  { nome: "Exibição de Arma de Fogo em Público", categoria: "Crimes Graves", multa: 25000, meses: 4, observacoes: "Exibir qualquer arma de fogo em público - exceto autodefesa" },
  { nome: "Fabrico Illegal de Armas", categoria: "Crimes Graves", multa: 112500, meses: 15, observacoes: "Fabricar armas de forma não declarada ou ilícito" },
  { nome: "Fabrico de Acessórios para Arma", categoria: "Crimes Graves", multa: 67500, meses: 10, observacoes: "Ato de conceber/fabricar acessórios para arma" },
  { nome: "Fabrico Illegal de Munição", categoria: "Crimes Graves", multa: 67500, meses: 10, observacoes: "Ato de conceber/fabricar munições" },
  { nome: "Homicídio", categoria: "Crimes Graves", multa: 85000, meses: 15, observacoes: "Matar uma pessoa deliberadamente - Funcionário público +15000€" },
  { nome: "Tentativa de Homicídio", categoria: "Crimes Graves", multa: 63750, meses: 11, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Homicídio por Negligência", categoria: "Crimes Graves", multa: 40000, meses: 8, observacoes: "Matar outra pessoa por negligência" },
  { nome: "Homicídio Qualificado", categoria: "Crimes Graves", multa: 100000, meses: 20, observacoes: "Homicídio que revela censurabilidade ou perversidade - Funcionário público +15000€" },
  { nome: "Tentativa de Homicídio Qualificado", categoria: "Crimes Graves", multa: 75000, meses: 15, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Incitação ao Ódio", categoria: "Crimes Graves", multa: 22500, meses: 5, observacoes: "Profere palavras que visem a repulsa ou hostilidade para com a vítima" },
  { nome: "Lavagem de Dinheiro", categoria: "Crimes Graves", multa: 100000, meses: 15, observacoes: "Captura durante o processo de lavagem de dinheiro" },
  { nome: "Tentativa de Lavagem de Dinheiro", categoria: "Crimes Graves", multa: 75000, meses: 11, observacoes: "Tentativa não consumada - 25% redução" },
  { nome: "Mineração Illegal", categoria: "Crimes Graves", multa: 50000, meses: 3, observacoes: "Posse de qualquer material proveniente da mineração illicit - Cumulativo com Posse de itens ilegais" },
  { nome: "Organização Criminosa", categoria: "Crimes Graves", multa: 90000, meses: 12, observacoes: "Pertencer e/ou colaborar com organização cuja atividade é maioritariamente ilegal" },
  { nome: "Posse de Arma Branca s/Porte ou Illegal", categoria: "Crimes Graves", multa: 15000, meses: 5, observacoes: "Posse de qualquer arma branca sem a devida documentação ou illegal" },
  { nome: "Posse de Dinheiro Não Declarado", categoria: "Crimes Graves", multa: 0, meses: 30, observacoes: "Coima corresponde a 75% do valor apreendido - Máximo 10000€ permitido" },
  { nome: "Posse de Munição", categoria: "Crimes Graves", multa: 10000, meses: 6, observacoes: "Verificar Tabela - Carregadores e balas em armas ilegais" },
  { nome: "Posse de Arma de Fogo Illegal de Baixo Calibre", categoria: "Crimes Graves", multa: 20000, meses: 12, observacoes: "FN model 1922, Taurus Racing Bull, Fajuta, Desert Eagle, AMT Backup" },
  { nome: "Posse de Arma de Fogo Illegal de Médio Calibre", categoria: "Crimes Graves", multa: 30000, meses: 15, observacoes: "Tec-9, Micro SMG, Mini Uzi, Combat PDW, P-90" },
  { nome: "Posse de Arma de Fogo Illegal de Alto Calibre", categoria: "Crimes Graves", multa: 80000, meses: 17, observacoes: "Draco AK, AK-M, Gusenberg, Famas, Shotgun 12 Gauge, TAR-21, Spas-12" },
  { nome: "Posse de Arma de Fogo s/Porte", categoria: "Crimes Graves", multa: 30000, meses: 10, observacoes: "Mosquete, FN Model - arma licenciada sem documentação" },
  { nome: "Racismo e Discriminação", categoria: "Crimes Graves", multa: 0, meses: 0, observacoes: "Questões salariais, posição na comunidade, orientação sexual - pedido pela acusação" },
  { nome: "Posse de Armas em Grande Quantidade", categoria: "Crimes Graves", multa: 0, meses: 0, observacoes: "Verificar tabela específica" },
  { nome: "Fabrico de Partes de Armamento", categoria: "Crimes Graves", multa: 105000, meses: 13, observacoes: "Posse de moldes ou esquemas acima de 5" },
  { nome: "Venda de Acessórios para Arma", categoria: "Crimes Graves", multa: 60000, meses: 7, observacoes: "Vender acessórios ilegais para armas" },
  { nome: "Venda de Coletes", categoria: "Crimes Graves", multa: 36000, meses: 10, observacoes: "Vender coletes de forma não declarada ou illicit" },
  { nome: "Venda de Licenças", categoria: "Crimes Graves", multa: 15000, meses: 3, observacoes: "Carta condução +6000€, cartão cidadão +15000€, licença caça +9000€, licença arma branca +4500€, licença arma fogo +10500€" },
  { nome: "Venda de Munição", categoria: "Crimes Graves", multa: 45000, meses: 8, observacoes: "Vender munição de forma não declarada ou illicit" },

  // ========== LEI 06/2022 - ATIVIDADES ILÍCITAS ==========
  { nome: "Atividade Illegal numa Empresa", categoria: "Atividades Ilícitas", multa: 200000, meses: 10, observacoes: "Quebrar as cláusulas estabelecidas nos contratos de legalização das empresas" },
  { nome: "Caça sem Porte", categoria: "Atividades Ilícitas", multa: 30000, meses: 5, observacoes: "Ato de caçar sem a devida documentação" },
  { nome: "Caçar fora do Perímetro Legal", categoria: "Atividades Ilícitas", multa: 10000, meses: 0, observacoes: "Caçar fora do perímetro estabelecido pelas autoridades" },
  { nome: "Caça Illegal", categoria: "Atividades Ilícitas", multa: 15000, meses: 0, observacoes: "Caçar espécies protegidas (veados)" },
  { nome: "Compra de Ferramentas de Roubo", categoria: "Atividades Ilícitas", multa: 75000, meses: 5, observacoes: "Quem adquire ferramentas usualmente utilizadas em roubos" },
  { nome: "Crueldade Animal", categoria: "Atividades Ilícitas", multa: 30000, meses: 4, observacoes: "Maltratar ou provocar a morte de qualquer animal sem causa aparente" },
  { nome: "Fabrico de Droga", categoria: "Atividades Ilícitas", multa: 75000, meses: 7, observacoes: "Captura durante o processo de transformação de droga" },
  { nome: "Fabrico Ferramentas de Roubo", categoria: "Atividades Ilícitas", multa: 22500, meses: 3, observacoes: "Flagrado durante o processo de fabrico de ferramentas de roubo" },
  { nome: "Fabrico de Medickits", categoria: "Atividades Ilícitas", multa: 60000, meses: 15, observacoes: "Flagrado durante o processo de fabrico de Medickits" },
  { nome: "Pesca sem Licença", categoria: "Atividades Ilícitas", multa: 30000, meses: 5, observacoes: "Ato de pescar sem a devida documentação" },
  { nome: "Pesca Illegal", categoria: "Atividades Ilícitas", multa: 30000, meses: 3, observacoes: "Pescar espécies protegidas (tubarões)" },
  { nome: "Posse de Matéria Prima para Fins Ilegais", categoria: "Atividades Ilícitas", multa: 30000, meses: 2, observacoes: "Petróleo, bicarbonato de sódio, pólvora, substâncias químicas (>500), ácido clorídrico, ácido sulfúrico, folhas de tabaco" },
  { nome: "Posse de Droga", categoria: "Atividades Ilícitas", multa: 22500, meses: 3, observacoes: "Até 200 cabeços cannabis / 20 pacotes / 2 óleos / 20 sacos + charros - acumula 1500€" },
  { nome: "Posse de Itens Ilegais", categoria: "Atividades Ilícitas", multa: 30000, meses: 5, observacoes: "Verificar Tabela" },
  { nome: "Posse de Droga em Grande Quantidade", categoria: "Atividades Ilícitas", multa: 0, meses: 0, observacoes: "Verificar tabela específica" },
  { nome: "Transporte de Mercadorias Ilegais", categoria: "Atividades Ilícitas", multa: 50000, meses: 0, observacoes: "Transporte de mercadorias ilegais" },
  { nome: "Venda de Droga", categoria: "Atividades Ilícitas", multa: 40000, meses: 10, observacoes: "Ato de vender droga" },
  { nome: "Venda de Ferramentas de Roubo", categoria: "Atividades Ilícitas", multa: 25000, meses: 4, observacoes: "Por cada item de roubo adicionar 1500€" },
  { nome: "Venda de Itens de Pesca Illegal", categoria: "Atividades Ilícitas", multa: 15000, meses: 2, observacoes: "Verificar tabela" },
  { nome: "Venda de Itens Ilegais", categoria: "Atividades Ilícitas", multa: 30000, meses: 7, observacoes: "Quem vender itens ilegais" },

  // ========== CRIMES DPSA ==========
  { nome: "Veículo Apreendido num Assalto", categoria: "Crimes DPSA", multa: 45000, meses: 0 },
  { nome: "Veículo Apreendido no Decorrer de Investigação", categoria: "Crimes DPSA", multa: 0, meses: 0 },
  { nome: "Veículo Apreendido no Decorrer de Tentativa de Fuga", categoria: "Crimes DPSA", multa: 25000, meses: 0 },
  { nome: "Veículo Apreendido por Falta de Carta", categoria: "Crimes DPSA", multa: 15000, meses: 0 },
  { nome: "Veículo Apreendido por Danos Premeditados", categoria: "Crimes DPSA", multa: 10000, meses: 0 },
];

// Alias for backwards compatibility
export type CrimeData = Crime;

// Tabela de armas em grande quantidade
export interface ArmaGrandeQuantidade {
  calibre: string;
  minQuantidade: number;
  multa: number;
  meses: number;
}

export const ARMAS_GRANDE_QUANTIDADE: ArmaGrandeQuantidade[] = [
  { calibre: "Baixo", minQuantidade: 5, multa: 150000, meses: 15 },
  { calibre: "Médio", minQuantidade: 4, multa: 200000, meses: 20 },
  { calibre: "Alto", minQuantidade: 3, multa: 250000, meses: 25 },
];

// Preços das drogas (em €)
export const PRECOS_DROGAS: Record<string, number> = {
  "Sementes de Cannabis": 150,
  "Cabeços de Cannabis": 135,
  "Óleo de Cannabis": 750,
  "Saco de Cannabis": 1100,
  "Pacote de Droga": 500,
  "Charros": 150,
  "Cristal": 165,
  "Cristal Processado": 1650,
  "Maço tabaco": 1550,
  "Estimulante": 500,
};

// Limites para cálculo (quantidade máxima antes de dobrar valor)
export const DROGAS_LIMITES: Record<string, number> = {
  "Sementes de Cannabis": 20,
  "Cabeços de Cannabis": 20,
  "Óleo de Cannabis": 5,
  "Saco de Cannabis": 3,
  "Pacote de Droga": 10,
  "Charros": 30,
  "Cristal": 15,
  "Cristal Processado": 5,
  "Maço tabaco": 20,
  "Estimulante": 10,
};

// Tabela completa de itens ilegais
export const ITENS_ILEGAIS: Record<string, number> = {
  "Acessórios para armas": 5000,
  "Adaga templária": 8800,
  "Algemas": 22500,
  "Anel de Diamante": 9000,
  "Baleia": 200000,
  "Barras Ouro": 5000,
  "Baú Especiarias": 3200,
  "Bens de assalto a casa": 3000,
  "Bomba 2ª Guerra": 5200,
  "C4": 17000,
  "Chifres": 150,
  "Colete": 5000,
  "Corrente de Ouro": 600,
  "Corrente de Ouro 10k": 1200,
  "Diamante": 6000,
  "Diário de Bordo": 2400,
  "Enxofre": 1400,
  "Esquemas de armas": 200,
  "Estanho": 50,
  "Ídolo Inca": 80000,
  "Lockpick": 22500,
  "Medickits": 12500,
  "Minérios": 500,
  "Níquel": 300,
  "Nitro": 2500,
  "Orca": 20000,
  "Pack Safira": 11500,
  "Pacote Ilegal": 1800,
  "Pager": 16000,
  "Peças Arma": 2500,
  "Pepitas de ouro": 500,
  "Polvo": 1200,
  "Pólvora": 750,
  "Raia": 1000,
  "Rebarbadora": 8500,
  "Relógio de Ouro": 1800,
  "Safiras": 600,
  "Tubarão Branco": 2400,
  "Tubarão Martelo": 3200,
};

// Preços de munição (por unidade)
export const MUNICAO_PRECOS: Record<string, number> = {
  "Balas Baixo Calibre": 500,
  "Balas Médio Calibre": 1000,
  "Balas Alto Calibre": 1500,
  "Carregador Baixo Calibre": 2000,
  "Carregador Médio Calibre": 4000,
  "Carregador Alto Calibre": 6000,
};

// Preços de EPI
export const EPI_ITENS: Record<string, number> = {
  "Colete Refletor": 2500,
  "Capacete": 2500,
  "Botas biqueira de aço": 2500,
  "Calças largas": 2500,
  "Máscara de proteção": 2500,
};
