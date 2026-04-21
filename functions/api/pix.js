// functions/api/pix.js — Cloudflare Pages Function

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let params = {};
  if (request.method === 'POST') {
    try { params = await request.json(); } catch(e) { params = {}; }
  } else {
    const url = new URL(request.url);
    url.searchParams.forEach((v, k) => { params[k] = v; });
  }

  const { acao, valor, email, nome, cpf } = params;

  if (acao !== 'gerar_pix') {
    return new Response(JSON.stringify({ sucesso: false, erro: 'Acao invalida.' }), {
      status: 400, headers: corsHeaders
    });
  }

  const SK = env.MEDUSA_SK || 'sk_live_v2IaJ7Pl5FQqItCibd4tuBbc2d6x6PY9jENJ5nDwxe';
  const auth = btoa(SK.trim() + ':x');
  const valorFloat = parseFloat((valor || '49.99').toString().replace(',', '.'));
  const valorCentavos = Math.round(valorFloat * 100);
  const cpfLimpo = (cpf || '').replace(/[^0-9]/g, '');

  const payload = {
    amount: valorCentavos,
    paymentMethod: 'pix',
    customer: {
      name: String(nome || 'Candidato'),
      email: String(email || 'candidato@email.com.br'),
      document: { number: cpfLimpo, type: 'cpf' }
    },
    items: [{
      title: 'Curso Profissional',
      unitPrice: valorCentavos,
      quantity: 1,
      tangible: false
    }],
    pix: { expiresInDays: 1 }
  };

  try {
    const response = await fetch('https://api.v2.medusapay.com.br/v1/transactions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth
      },
      body: JSON.stringify(payload)
    });

    const resultado = await response.json();

    if (response.ok) {
      const d = resultado.data || resultado;
      const pix = d.pix || d.pixData || {};

      const qr_code =
        pix.qrcode_base64 || pix.qrcodeBase64 || pix.qrCodeBase64 ||
        d.qrcode_base64 || d.qrcodeBase64 || null;

      const copia_cola =
        pix.qrcode || pix.payload || pix.emv ||
        pix.copiaCola || pix.copia_cola ||
        d.qrcode || d.payload || null;

      return new Response(JSON.stringify({
        sucesso: true,
        qr_code: qr_code,
        copia_cola: copia_cola
      }), { status: 200, headers: corsHeaders });

    } else {
      const msg = resultado.message || resultado.error || 'Erro desconhecido';
      return new Response(JSON.stringify({
        sucesso: false,
        erro: 'MedusaPay: ' + msg + ' (HTTP ' + response.status + ')'
      }), { status: 200, headers: corsHeaders });
    }

  } catch(err) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: 'Erro de conexao: ' + err.message
    }), { status: 200, headers: corsHeaders });
  }
}
