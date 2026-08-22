import { assertEquals } from '@std/assert';
import { buildChamado, extractInboundMessages } from './parser.ts';

function metaPayload(message: Record<string, unknown>, contactName = 'Zeca Guincho') {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '123',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          contacts: [{ profile: { name: contactName }, wa_id: '5511999998888' }],
          messages: [message],
        },
      }],
    }],
  };
}

function textMessage(body: string, id = 'wamid.ABC') {
  return {
    from: '5511999998888',
    id,
    timestamp: '1754654400',
    type: 'text',
    text: { body },
  };
}

Deno.test('extrai mensagem de texto do payload da Meta', () => {
  const messages = extractInboundMessages(metaPayload(textMessage('preciso de guincho')));
  assertEquals(messages.length, 1);
  assertEquals(messages[0].id, 'wamid.ABC');
  assertEquals(messages[0].from, '5511999998888');
  assertEquals(messages[0].profileName, 'Zeca Guincho');
  assertEquals(messages[0].text, 'preciso de guincho');
  assertEquals(messages[0].timestamp, '2025-08-08T12:00:00.000Z');
});

Deno.test('ignora webhook de status (entregue/lido)', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: { statuses: [{ id: 'wamid.X', status: 'delivered' }] },
      }],
    }],
  };
  assertEquals(extractInboundMessages(payload), []);
});

Deno.test('ignora payload vazio ou sem formato conhecido', () => {
  assertEquals(extractInboundMessages(null), []);
  assertEquals(extractInboundMessages({ foo: 'bar' }), []);
});

Deno.test('extrai payload plano de gateway (Z-API) e ignora mensagem propria', () => {
  const recebida = extractInboundMessages({
    messageId: 'ZAPI-1',
    phone: '5511988887777',
    senderName: 'Maria',
    momment: 1754654400000,
    text: { message: 'meu carro quebrou' },
  });
  assertEquals(recebida.length, 1);
  assertEquals(recebida[0].from, '5511988887777');
  assertEquals(recebida[0].text, 'meu carro quebrou');

  const enviada = extractInboundMessages({
    messageId: 'ZAPI-2',
    phone: '5511988887777',
    fromMe: true,
    text: { message: 'ok, estamos a caminho' },
  });
  assertEquals(enviada, []);
});

Deno.test('monta chamado a partir de mensagem com rotulos', () => {
  const texto = [
    'Nome: João da Silva',
    'Telefone: (11) 98888-7777',
    'Tipo: guincho',
    'Veículo: Fiat Uno 2012',
    'Placa: ABC1D23',
    'Local: Av. Paulista, 1000 - São Paulo',
    'Destino: Oficina do Zé, Santo André',
    'Obs: carro não liga',
  ].join('\n');

  const [message] = extractInboundMessages(metaPayload(textMessage(texto)));
  const chamado = buildChamado(message);

  assertEquals(chamado.nome_cliente, 'João da Silva');
  assertEquals(chamado.telefone, '11988887777');
  assertEquals(chamado.tipo_servico, 'guincho');
  assertEquals(chamado.veiculo, 'Fiat Uno 2012');
  assertEquals(chamado.placa, 'ABC1D23');
  assertEquals(chamado.endereco_origem, 'Av. Paulista, 1000 - São Paulo');
  assertEquals(chamado.endereco_destino, 'Oficina do Zé, Santo André');
  assertEquals(chamado.descricao, 'carro não liga');
  assertEquals(chamado.wa_message_id, 'wamid.ABC');
  assertEquals(chamado.canal, 'whatsapp');
});

Deno.test('texto livre vira descricao e infere tipo e placa', () => {
  const [message] = extractInboundMessages(
    metaPayload(textMessage('bom dia, preciso de reboque na br-116, placa RST-4567')),
  );
  const chamado = buildChamado(message);

  assertEquals(chamado.tipo_servico, 'guincho');
  assertEquals(chamado.placa, 'RST4567');
  assertEquals(chamado.descricao, 'bom dia, preciso de reboque na br-116, placa RST-4567');
  assertEquals(chamado.nome_cliente, 'Zeca Guincho');
  assertEquals(chamado.telefone, '5511999998888');
});

Deno.test('infere autossocorro e transporte por palavra-chave', () => {
  const socorro = buildChamado(
    extractInboundMessages(metaPayload(textMessage('bateria arriada, preciso de chaveiro')))[0],
  );
  assertEquals(socorro.tipo_servico, 'autossocorro');

  const frete = buildChamado(
    extractInboundMessages(metaPayload(textMessage('orçamento de frete de carga para Campinas')))[0],
  );
  assertEquals(frete.tipo_servico, 'transporte');
});

Deno.test('usa localizacao compartilhada como origem', () => {
  const payload = metaPayload({
    from: '5511999998888',
    id: 'wamid.LOC',
    timestamp: '1754654400',
    type: 'location',
    location: {
      latitude: -23.5613,
      longitude: -46.6565,
      name: 'Av. Paulista',
      address: 'Av. Paulista, 1000 - São Paulo',
    },
  });
  const chamado = buildChamado(extractInboundMessages(payload)[0]);

  assertEquals(chamado.latitude, -23.5613);
  assertEquals(chamado.longitude, -46.6565);
  assertEquals(chamado.endereco_origem, 'Av. Paulista, 1000 - São Paulo');
});

Deno.test('le resposta de botao e legenda de imagem', () => {
  const botao = extractInboundMessages(metaPayload({
    from: '5511999998888',
    id: 'wamid.BTN',
    timestamp: '1754654400',
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: '1', title: 'Guincho' } },
  }));
  assertEquals(botao[0].text, 'Guincho');
  assertEquals(buildChamado(botao[0]).tipo_servico, 'guincho');

  const imagem = extractInboundMessages(metaPayload({
    from: '5511999998888',
    id: 'wamid.IMG',
    timestamp: '1754654400',
    type: 'image',
    image: { id: 'media-1', caption: 'foto do veículo na pane' },
  }));
  assertEquals(imagem[0].text, 'foto do veículo na pane');
});

Deno.test('mensagem toda rotulada nao repete o texto inteiro na descricao', () => {
  const texto = ['Tipo: guincho', 'Placa: ABC1D23', 'Local: Av. Paulista, 1000'].join('\n');
  const chamado = buildChamado(extractInboundMessages(metaPayload(textMessage(texto)))[0]);

  assertEquals(chamado.descricao, null);
  assertEquals(chamado.tipo_servico, 'guincho');
  assertEquals(chamado.endereco_origem, 'Av. Paulista, 1000');
});

Deno.test('linha solta junto de rotulos vira descricao', () => {
  const texto = ['Tipo: guincho', 'o carro esta na garagem do predio'].join('\n');
  const chamado = buildChamado(extractInboundMessages(metaPayload(textMessage(texto)))[0]);

  assertEquals(chamado.descricao, 'o carro esta na garagem do predio');
});

Deno.test('mensagem sem texto nem rotulo nao quebra o chamado', () => {
  const [message] = extractInboundMessages(metaPayload({
    from: '5511999998888',
    id: 'wamid.AUDIO',
    timestamp: '1754654400',
    type: 'audio',
    audio: { id: 'media-2' },
  }));
  const chamado = buildChamado(message);

  assertEquals(chamado.descricao, null);
  assertEquals(chamado.tipo_servico, 'outro');
  assertEquals(chamado.placa, null);
  assertEquals(chamado.telefone, '5511999998888');
});
