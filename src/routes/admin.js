const router = require('express').Router();
const { confirmPayment } = require('../services/paymentService');
const { listOrdersForAdmin } = require('../services/orderService');
const {
  ensureDeliveryForOrder,
  getDeliveryByOrderId,
  setDeliveryStatus,
  listDeliveriesForAdmin,
} = require('../services/deliveryService');
const {
  listProductsForAdmin,
  adjustProductStock,
  createProduct,
  updateProductPrice,
  updateProductTotalStock,
  deactivateProduct,
} = require('../services/productService');
const { cancelExpiredPendingOrders } = require('../services/orderService');
const { ADMIN_TOKEN } = require('../config/env');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/admin/panel', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Painel Admin - RD Store</title>
    <style>
      :root { --bg:#f6f7fb; --card:#fff; --text:#0f172a; --muted:#475569; --line:#e2e8f0; --ok:#166534; --warn:#92400e; --bad:#991b1b; }
      * { box-sizing: border-box; }
      body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: var(--bg); color: var(--text); }
      .wrap { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
      .card { background: var(--card); border:1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 16px; }
      .card-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 20px;
        font-weight: 800;
        cursor: pointer;
      }
      .card-toggle:hover { background:#f8fafc; }
      .toggle-arrow { font-size: 18px; color:#334155; transition: transform .15s ease; }
      .section-body { margin-top: 12px; }
      .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      input, select, button { padding: 10px 12px; border:1px solid #cbd5e1; border-radius: 10px; }
      button { cursor:pointer; background:#0f172a; color:#fff; border:none; }
      table { width:100%; border-collapse: collapse; font-size:14px; }
      th, td { border-bottom:1px solid var(--line); text-align:left; padding: 8px; vertical-align: top; }
      .muted { color:var(--muted); font-size: 13px; }
      .ok { color: var(--ok); font-weight:600; }
      .warn { color: var(--warn); font-weight:600; }
      .bad { color: var(--bad); font-weight:600; }
      .sizes-grid { display:grid; grid-template-columns: repeat(4, minmax(100px, 1fr)); gap:6px; }
      .size-card { border:1px solid #dbe4f0; border-radius:12px; padding:8px; background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%); box-shadow: 0 1px 2px rgba(15,23,42,.05); }
      .size-title { font-size:11px; color:#475569; font-weight:700; letter-spacing:.08em; }
      .size-value { font-size:17px; font-weight:800; margin:4px 0 6px; cursor:pointer; color:#0f172a; }
      .size-actions { display:flex; gap:6px; }
      .size-btn { padding:4px 8px; border-radius:8px; border:1px solid #94a3b8; background:#fff; color:#0f172a; cursor:pointer; }
      .size-btn:hover { background:#e2e8f0; }
      .inline-input { width:90px; padding:6px 8px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; }
      .inline-stock { width:70px; padding:6px 8px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; }
      .danger-btn { padding:6px 10px; border-radius:8px; border:1px solid #ef4444; color:#b91c1c; background:#fff; cursor:pointer; }
      .danger-btn:hover { background:#fee2e2; }
      .primary-action {
        background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
        color: #fff;
        border: 1px solid #1e3a8a;
        border-radius: 12px;
        padding: 10px 16px;
        font-weight: 700;
        letter-spacing: .01em;
        box-shadow: 0 6px 14px rgba(30, 58, 138, .2);
        transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
      }
      .primary-action:hover { transform: translateY(-1px); box-shadow: 0 10px 18px rgba(30, 58, 138, .26); filter: brightness(1.03); }
      .primary-action:active { transform: translateY(0); box-shadow: 0 4px 10px rgba(30, 58, 138, .2); }
      .section-title { display:flex; justify-content:space-between; align-items:center; margin: 8px 0; }
      .badge { display:inline-block; font-size:12px; padding:4px 8px; border-radius:999px; border:1px solid var(--line); color:#334155; }
      .search-wrap { display:flex; gap:8px; align-items:center; width:100%; }
      .search-input { flex:1; min-width:260px; }
      .search-clear { background:#fff; color:#0f172a; border:1px solid #cbd5e1; }
      .search-hint { margin-left:auto; font-size:12px; color:#64748b; }
      .hl { background:#fff3bf; border-radius:4px; padding:0 2px; }
      .empty-row { text-align:center; color:#64748b; padding:14px; }
      .pagination { display:flex; gap:8px; align-items:center; justify-content:flex-end; margin-top:10px; }
      .page-btn { background:#fff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:6px 10px; cursor:pointer; }
      .page-btn:disabled { opacity:.5; cursor:not-allowed; }
      .page-indicator { font-size:12px; color:#475569; min-width:90px; text-align:center; }
      .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:none; align-items:center; justify-content:center; padding:16px; z-index:50; }
      .modal { width:min(760px, 100%); max-height:90vh; overflow:auto; background:#fff; border-radius:14px; border:1px solid var(--line); padding:16px; }
      .modal h4 { margin: 4px 0 10px; }
      .close-btn { background:#fff; color:#0f172a; border:1px solid #cbd5e1; }
      .customer-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
      .item-line { padding:8px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; }
      .list-clean { list-style:none; padding-left:0; margin:8px 0; }
      .list-clean li { padding:8px 10px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; }
      @media (max-width: 768px) {
        .sizes-grid { grid-template-columns: repeat(2, minmax(100px, 1fr)); }
        .customer-grid { grid-template-columns:1fr; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h2>Painel do Vendedor</h2>
        <p class="muted">Use o token admin para entrar no painel.</p>
        <div class="row">
          <input id="token" placeholder="x-admin-token" style="min-width:280px" autocomplete="off" onkeydown="onTokenKeydown(event)" />
          <button onclick="loginAdmin()">Entrar</button>
        </div>
        <div id="loginMsg" class="muted" style="margin-top:8px"></div>
      </div>

      <div class="card" id="ordersCard" style="display:none">
        <button class="card-toggle" onclick="toggleSection('ordersSection','ordersArrow')">
          <span>Pedidos</span><span id="ordersArrow" class="toggle-arrow">▸</span>
        </button>
        <div id="ordersSection" class="section-body" style="display:none">
          <div class="row" style="margin-bottom:8px"><button onclick="loadOrders()">Atualizar pedidos</button></div>
          <div id="ordersInfo" class="muted"></div>
          <div class="section-title"><strong>Pagos / Confirmados</strong><span id="paidCount" class="badge">0</span></div>
          <table id="ordersPaidTable"></table>
          <div id="ordersPagination" class="pagination"></div>
        </div>
      </div>

      <div class="card" id="deliveriesCard" style="display:none">
        <button class="card-toggle" onclick="toggleSection('deliveriesSection','deliveriesArrow')">
          <span>Entregas</span><span id="deliveriesArrow" class="toggle-arrow">▸</span>
        </button>
        <div id="deliveriesSection" class="section-body" style="display:none">
          <div class="row" style="margin-bottom:8px"><button onclick="loadDeliveries()">Atualizar entregas</button></div>
          <div id="deliveriesInfo" class="muted"></div>
          <div class="section-title"><strong>Enviados</strong><span id="deliveriesSentCount" class="badge">0</span></div>
          <table id="deliveriesSentTable"></table>
          <div id="deliveriesPagination" class="pagination"></div>
        </div>
      </div>

      <div class="card" id="stockCard" style="display:none">
        <button class="card-toggle" onclick="toggleSection('stockSection','stockArrow')">
          <span>Estoque</span><span id="stockArrow" class="toggle-arrow">▸</span>
        </button>
        <div id="stockSection" class="section-body" style="display:none">
          <div class="row" style="margin-bottom:8px">
            <div class="search-wrap">
              <input
                id="stockSearch"
                class="search-input"
                placeholder="Pesquisar produto por nome ou ID"
                oninput="applyStockSearch()"
                autocomplete="off"
              />
              <button class="search-clear" onclick="clearStockSearch()">Limpar</button>
              <span class="search-hint">atalho: /</span>
            </div>
          </div>
          <div id="stockSearchInfo" class="muted" style="margin-bottom:8px"></div>
          <div class="row">
            <input id="newName" placeholder="Nome da camisa" style="min-width:260px" />
            <input id="newPrice" type="number" step="0.01" placeholder="Preço" />
            <select id="newSize">
              <option value="P">P</option>
              <option value="M">M</option>
              <option value="G">G</option>
              <option value="GG">GG</option>
            </select>
            <input id="newStock" type="number" placeholder="Quantidade" />
            <button onclick="createNewProduct()">Adicionar produto</button>
          </div>
          <div id="newProductMsg" class="muted" style="margin-top:8px"></div>
          <table id="productsTable" style="margin-top:12px"></table>
          <div id="productsPagination" class="pagination"></div>
        </div>
      </div>
    </div>
    <div id="orderModalBackdrop" class="modal-backdrop">
      <div class="modal">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h4 id="orderModalTitle">Detalhes do pedido</h4>
          <button class="close-btn" onclick="closeOrderModal()">Fechar</button>
        </div>
        <div id="orderModalBody"></div>
      </div>
    </div>
    <script>
      let productsCache = [];
      let stockSearchLastRaw = '';
      const PAGE_SIZE = 10;
      const pageState = { orders: 1, deliveries: 1, products: 1 };

      function token() { return document.getElementById('token').value.trim(); }
      function headers() {
        const currentToken = token();
        if (!currentToken) {
          throw new Error('Informe o token admin antes de continuar.');
        }
        return { 'x-admin-token': currentToken, 'Content-Type': 'application/json' };
      }
      function setDashboardVisible(visible) {
        document.getElementById('ordersCard').style.display = visible ? 'block' : 'none';
        document.getElementById('deliveriesCard').style.display = visible ? 'block' : 'none';
        document.getElementById('stockCard').style.display = visible ? 'block' : 'none';
      }
      function setSectionExpanded(sectionId, arrowId, expanded) {
        const section = document.getElementById(sectionId);
        const arrow = document.getElementById(arrowId);
        if (!section || !arrow) return;
        section.style.display = expanded ? 'block' : 'none';
        arrow.textContent = expanded ? '▾' : '▸';
      }
      function toggleSection(sectionId, arrowId) {
        const section = document.getElementById(sectionId);
        if (!section) return;
        const expanded = section.style.display !== 'none';
        setSectionExpanded(sectionId, arrowId, !expanded);
      }
      function collapseAllSections() {
        setSectionExpanded('ordersSection', 'ordersArrow', false);
        setSectionExpanded('deliveriesSection', 'deliveriesArrow', false);
        setSectionExpanded('stockSection', 'stockArrow', false);
      }
      function clampPage(page, totalPages) {
        if (totalPages <= 0) return 1;
        if (page < 1) return 1;
        if (page > totalPages) return totalPages;
        return page;
      }
      function paginateRows(rows, page) {
        const totalItems = rows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const safePage = clampPage(page, totalPages);
        const start = (safePage - 1) * PAGE_SIZE;
        const sliced = rows.slice(start, start + PAGE_SIZE);
        return { rows: sliced, totalItems, totalPages, page: safePage };
      }
      function renderPagination(containerId, key, totalItems, totalPages, page) {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (totalItems <= PAGE_SIZE) {
          el.innerHTML = '';
          return;
        }
        const prevDisabled = page <= 1 ? 'disabled' : '';
        const nextDisabled = page >= totalPages ? 'disabled' : '';
        el.innerHTML =
          '<button class=\"page-btn\" ' + prevDisabled + ' onclick=\"setTablePage(\\'' + key + '\\',' + (page - 1) + ')\">Anterior</button>' +
          '<span class=\"page-indicator\">Página ' + page + '/' + totalPages + '</span>' +
          '<button class=\"page-btn\" ' + nextDisabled + ' onclick=\"setTablePage(\\'' + key + '\\',' + (page + 1) + ')\">Próxima</button>';
      }
      function setTablePage(key, page) {
        pageState[key] = page;
        if (key === 'orders') {
          loadOrders();
          return;
        }
        if (key === 'deliveries') {
          loadDeliveries();
          return;
        }
        applyStockSearch();
      }
      async function loginAdmin() {
        const msg = document.getElementById('loginMsg');
        msg.textContent = '';
        try {
          const res = await fetch('/admin/summary', { headers: headers() });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Token inválido');
          msg.textContent = 'Login realizado com sucesso.';
          msg.className = 'ok';
          setDashboardVisible(true);
          collapseAllSections();
          await loadAll();
        } catch (err) {
          setDashboardVisible(false);
          msg.textContent = err.message || 'Falha no login';
          msg.className = 'bad';
        }
      }
      function onTokenKeydown(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        loginAdmin();
      }
      function statusClass(v) {
        const normalized = String(v || '').toLowerCase();
        if (normalized === 'paid' || normalized === 'confirmed' || normalized === 'delivered' || normalized === 'out_for_delivery') return 'ok';
        if (normalized === 'pending' || normalized === 'ready') return 'warn';
        return 'bad';
      }
      function statusLabel(v) {
        const normalized = String(v || '').toLowerCase();
        const map = {
          pending: 'pendente',
          confirmed: 'confirmado',
          paid: 'pago',
          delivered: 'enviado',
          ready: 'pendente de envio',
          out_for_delivery: 'enviado',
          failed: 'falhou',
          cancelled: 'cancelado'
        };
        return map[normalized] || String(v || '-');
      }
      function textOrDash(v) {
        return v == null || String(v).trim() === '' ? '-' : String(v);
      }
      function customerField(customer, keys) {
        for (const key of keys) {
          if (customer[key] != null && String(customer[key]).trim() !== '') {
            return String(customer[key]);
          }
        }
        return '-';
      }
      function renderOrderItems(summary, fallbackName) {
        const raw = String(summary || '').trim();
        if (!raw) return String(fallbackName || '-');
        const parts = raw.split('|||').map((p) => p.trim()).filter(Boolean);
        if (!parts.length) return String(fallbackName || '-');
        return parts.join('<br>');
      }
      function renderDeliveryItems(items) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) return '-';
        const lines = list.map((item) => {
          const name = String(item?.product_name || '-').trim();
          const size = String(item?.size || '').trim();
          return size ? (name + ' (' + size + ')') : name;
        });
        return lines.join('<br>');
      }
      function getSimulatedNowMs() {
        const params = new URLSearchParams(window.location.search);
        const hours = Number(params.get('simulateHours') || 0);
        if (!Number.isFinite(hours) || hours === 0) return Date.now();
        return Date.now() + (hours * 60 * 60 * 1000);
      }
      function getSimulationLabel() {
        const params = new URLSearchParams(window.location.search);
        const hours = Number(params.get('simulateHours') || 0);
        if (!Number.isFinite(hours) || hours === 0) return '';
        const sign = hours > 0 ? '+' : '';
        return ' | modo teste: ' + sign + String(hours) + 'h';
      }
      function normalizeSearchText(v) {
        return String(v || '')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .toLowerCase()
          .trim();
      }
      function escapeHtml(v) {
        return String(v || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
      function highlightMatch(text, rawQuery) {
        const safeText = escapeHtml(text);
        const q = String(rawQuery || '').trim();
        if (!q) return safeText;
        const escaped = q.replace(/[-/\\^$*+?.()|[\\]]/g, '\\\\$&');
        const rx = new RegExp('(' + escaped + ')', 'ig');
        return safeText.replace(rx, '<span class=\"hl\">$1</span>');
      }
      function clearStockSearch() {
        const inputEl = document.getElementById('stockSearch');
        if (inputEl) inputEl.value = '';
        applyStockSearch();
        if (inputEl) inputEl.focus();
      }
      function applyStockSearch() {
        const inputEl = document.getElementById('stockSearch');
        const infoEl = document.getElementById('stockSearchInfo');
        const queryRaw = inputEl ? inputEl.value : '';
        if (queryRaw !== stockSearchLastRaw) {
          pageState.products = 1;
        }
        stockSearchLastRaw = queryRaw;
        const query = normalizeSearchText(queryRaw);
        const filtered = !query
          ? productsCache
          : productsCache.filter((p) => {
            const name = normalizeSearchText(p.name);
            const idText = String(p.id || '');
            return name.includes(query) || idText.includes(query);
          });
        renderProductsTable(filtered, queryRaw);
        if (infoEl) {
          infoEl.textContent = query
            ? (filtered.length + ' produto(s) encontrado(s) para "' + queryRaw + '"')
            : (productsCache.length + ' produto(s) no estoque');
        }
      }

      async function loadOrders() {
        const res = await fetch('/admin/orders', { headers: headers() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar pedidos');
        const rows = data.orders || [];

        const paidRows = rows.filter((o) => {
          const pay = String(o.payment_status || '').toLowerCase();
          const delivery = String(o.delivery_status || '').toLowerCase();
          return pay === 'confirmed' && delivery !== 'out_for_delivery' && delivery !== 'delivered';
        });
        document.getElementById('ordersInfo').textContent = paidRows.length + ' pedido(s) encontrado(s)';

        document.getElementById('paidCount').textContent = String(paidRows.length);
        const paged = paginateRows(paidRows, pageState.orders);
        pageState.orders = paged.page;

        const head = '<tr><th>ID</th><th>Cliente</th><th>Itens</th><th>Tam.</th><th>Total</th><th>Pagamento</th><th>Status</th></tr>';
        const paidBody = paged.rows.map(o => {
          return '<tr>' +
            '<td>#' + o.id + '</td>' +
            '<td>' + (o.customer_phone || '-') + '</td>' +
            '<td>' + renderOrderItems(o.items_summary, o.product_name) + '</td>' +
            '<td>' + (o.sizes || '-') + '</td>' +
            '<td>R$ ' + Number(o.total || 0).toFixed(2) + '</td>' +
            '<td class="' + statusClass(o.payment_status || o.status) + '">' + statusLabel(o.payment_status || o.status) + '</td>' +
            '<td><button class="primary-action" onclick="openDelivery(' + o.id + ')">Realizar envio</button></td>' +
            '</tr>';
        }).join('');

        document.getElementById('ordersPaidTable').innerHTML = head + paidBody;
        renderPagination('ordersPagination', 'orders', paged.totalItems, paged.totalPages, paged.page);
      }

      async function openDelivery(orderId) {
        const res = await fetch('/admin/deliveries/by-order/' + orderId, { headers: headers() });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Erro ao carregar detalhes');

        const delivery = data.delivery;
        const customer = delivery.customer_snapshot || {};
        const items = delivery.items_snapshot || [];
        const customerName = customerField(customer, ['nome', 'name']);
        const customerPhone = customerField(customer, ['telefone', 'phone']);
        const customerAddress = textOrDash(
          delivery.delivery_address ||
          customer.address ||
          customer.endereco ||
          customer.shipping_address ||
          customer.address_line
        );
        const customerFields = [
          '<li><strong>Nome:</strong> ' + customerName + '</li>',
          '<li><strong>Telefone:</strong> ' + customerPhone + '</li>',
          '<li><strong>Endereço:</strong> ' + customerAddress + '</li>'
        ].join('');
        const itemsHtml = items.map((item) =>
          '<li>' +
          (item.product_name || '-') +
          ' | tam: ' + (item.size || '-') +
          ' | qtd: ' + (item.quantity || 1) +
          '</li>'
        ).join('');

        document.getElementById('orderModalTitle').textContent = 'Entrega do pedido #' + delivery.order_id;
        document.getElementById('orderModalBody').innerHTML =
          '<div><strong>Status da entrega:</strong> ' + statusLabel(delivery.status) + ' | <strong>Pagamento:</strong> ' + statusLabel(delivery.payment_status) + '</div>' +
          '<div style="margin-top:12px"><strong>Dados do cliente</strong></div>' +
          '<ul class="list-clean">' + customerFields + '</ul>' +
          '<div style="margin-top:12px"><strong>Itens do pedido</strong></div>' +
          '<ul class="list-clean">' + itemsHtml + '</ul>' +
          '<div class="row" style="margin-top:10px">' +
          deliveryActionHtml(delivery) +
          '</div>';

        document.getElementById('orderModalBackdrop').style.display = 'flex';
      }

      function closeOrderModal() {
        document.getElementById('orderModalBackdrop').style.display = 'none';
      }

      function deliveryActionHtml(delivery) {
        const status = String(delivery.status || '').toLowerCase();
        if (status === 'delivered' || status === 'out_for_delivery') {
          return '<span class="ok">Pedido enviado.</span>';
        }
        if (status === 'ready') {
          return '<button onclick="markOutForDelivery(' + delivery.order_id + ')">Marcar como enviado</button>';
        }
        return '<span class="ok">Pedido enviado.</span>';
      }
      async function markOutForDelivery(orderId) {
        const res = await fetch('/admin/deliveries/' + orderId + '/status', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ status: 'out_for_delivery' })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Erro ao atualizar entrega');
        closeOrderModal();
        await loadOrders();
        await loadDeliveries();
        await loadProducts();
      }

      async function loadDeliveries() {
        const res = await fetch('/admin/deliveries', { headers: headers() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar entregas');
        const rows = data.deliveries || [];
        const nowMs = getSimulatedNowMs();
        const cutoffMs = nowMs - (24 * 60 * 60 * 1000);
        const sentRows = rows.filter((d) => {
          const status = String(d.status || '').toLowerCase();
          const refDate = d.updated_at || d.created_at;
          const refMs = refDate ? new Date(refDate).getTime() : 0;
          const isRecent = Number.isFinite(refMs) && refMs >= cutoffMs;
          return (status === 'out_for_delivery' || status === 'delivered') && isRecent;
        });
        document.getElementById('deliveriesInfo').textContent =
          sentRows.length + ' entrega(s) encontrada(s) nas últimas 24h' + getSimulationLabel();
        document.getElementById('deliveriesSentCount').textContent = String(sentRows.length);
        const paged = paginateRows(sentRows, pageState.deliveries);
        pageState.deliveries = paged.page;

        const sentHead = '<tr><th>ID Pedido</th><th>Cliente</th><th>Itens</th><th>Tam.</th><th>Total</th><th>Pagamento</th><th>Status Entrega</th></tr>';
        const sentBody = paged.rows.map((d) => {
          const customer = d.customer_snapshot || {};
          const items = Array.isArray(d.items_snapshot) ? d.items_snapshot : [];
          const itemsSummary = renderDeliveryItems(items);
          const sizes = items.map((i) => i.size).filter(Boolean);
          const sizesText = sizes.length ? [...new Set(sizes)].join(', ') : '-';
          return '<tr>' +
            '<td>#' + d.order_id + '</td>' +
            '<td>' + (customer.phone || d.recipient_phone || '-') + '</td>' +
            '<td>' + itemsSummary + '</td>' +
            '<td>' + sizesText + '</td>' +
            '<td>R$ ' + Number(d.total || 0).toFixed(2) + '</td>' +
            '<td class="' + statusClass(d.payment_status) + '">' + statusLabel(d.payment_status) + '</td>' +
            '<td class="' + statusClass(d.status) + '">' + statusLabel(d.status) + '</td>' +
            '</tr>';
        }).join('');

        document.getElementById('deliveriesSentTable').innerHTML = sentHead + sentBody;
        renderPagination('deliveriesPagination', 'deliveries', paged.totalItems, paged.totalPages, paged.page);
      }

      async function loadProducts() {
        const res = await fetch('/admin/products', { headers: headers() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar produtos');
        productsCache = data.products || [];
        applyStockSearch();
      }

      function renderProductsTable(rows, rawQuery = '') {
        const head = '<tr><th>ID</th><th>Nome</th><th>Preço</th><th>Estoque</th><th>Tamanhos</th><th>Ações</th></tr>';
        const paged = paginateRows(rows, pageState.products);
        pageState.products = paged.page;
        if (!paged.totalItems) {
          document.getElementById('productsTable').innerHTML =
            head + '<tr><td class=\"empty-row\" colspan=\"6\">Nenhum produto encontrado.</td></tr>';
          renderPagination('productsPagination', 'products', 0, 1, 1);
          return;
        }
        const body = paged.rows.map(p => '<tr>' +
          '<td>' + highlightMatch(String(p.id), rawQuery) + '</td>' +
          '<td>' + highlightMatch(p.name, rawQuery) + '</td>' +
          '<td>' +
            '<input class=\"inline-input\" value=\"' + Number(p.price || 0).toFixed(2) + '\" ' +
            'onkeydown=\"onPriceKeydown(event,' + p.id + ',this)\" title=\"Pressione Enter para salvar\" />' +
          '</td>' +
          '<td>' +
            '<input class=\"inline-stock\" value=\"' + Number(p.stock || 0) + '\" ' +
            'onkeydown=\"onStockKeydown(event,' + p.id + ',this)\" title=\"Pressione Enter para salvar\" />' +
          '</td>' +
          '<td>' + renderSizesCell(p) + '</td>' +
          '<td><button class=\"danger-btn\" onclick=\"deleteProduct(' + p.id + ',\\'' + String(p.name || '').replace(/'/g, "\\\\'") + '\\')\">🗑 Excluir</button></td>' +
          '</tr>').join('');
        document.getElementById('productsTable').innerHTML = head + body;
        renderPagination('productsPagination', 'products', paged.totalItems, paged.totalPages, paged.page);
      }

      function renderSizesCell(product) {
        const sizes = ['P', 'M', 'G', 'GG'];
        const map = product.sizes_map || {};
        return '<div class=\"sizes-grid\">' + sizes.map(size => {
          const val = Number(map[size] || 0);
          return '<div class=\"size-card\">' +
            '<div class=\"size-title\">' + size + '</div>' +
            '<div class=\"size-value\" title=\"Clique para definir\" onclick=\"setSize(' + product.id + ',\\'' + size + '\\',' + val + ')\">' + val + '</div>' +
            '<div class=\"size-actions\">' +
            '<button class=\"size-btn\" onclick=\"adjustSize(' + product.id + ',\\'' + size + '\\',-1)\">-1</button>' +
            '<button class=\"size-btn\" onclick=\"adjustSize(' + product.id + ',\\'' + size + '\\',1)\">+1</button>' +
            '</div>' +
            '</div>';
        }).join('') + '</div>';
      }

      async function adjustSize(productId, size, delta) {
        const res = await fetch('/admin/products/' + productId + '/stock', {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ mode: 'increment', amount: delta, size })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Erro ao ajustar tamanho');
        await loadProducts();
      }

      async function setSize(productId, size, currentValue) {
        const nextValue = prompt('Novo estoque para tamanho ' + size + ':', String(currentValue));
        if (nextValue === null) return;
        const parsed = Number(nextValue);
        if (!Number.isInteger(parsed) || parsed < 0) {
          return alert('Digite um número inteiro maior ou igual a 0');
        }
        const res = await fetch('/admin/products/' + productId + '/stock', {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ mode: 'set', amount: parsed, size })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Erro ao definir tamanho');
        await loadProducts();
      }

      async function onPriceKeydown(event, productId, inputEl) {
        if (event.key !== 'Enter') return;
        const parsed = Number(inputEl.value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          alert('Digite um preço válido maior que zero.');
          inputEl.focus();
          return;
        }
        const res = await fetch('/admin/products/' + productId + '/price', {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ price: parsed })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Erro ao atualizar preço');
          return;
        }
        inputEl.blur();
        await loadProducts();
      }

      async function onStockKeydown(event, productId, inputEl) {
        if (event.key !== 'Enter') return;
        const parsed = Number(inputEl.value);
        if (!Number.isInteger(parsed) || parsed < 0) {
          alert('Digite um estoque inteiro >= 0');
          inputEl.focus();
          return;
        }
        const res = await fetch('/admin/products/' + productId + '/stock-total', {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ stock: parsed })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Erro ao atualizar estoque');
          return;
        }
        inputEl.blur();
        await loadProducts();
      }

      async function deleteProduct(productId, productName) {
        const ok = confirm('Excluir produto \"' + productName + '\"?');
        if (!ok) return;
        const res = await fetch('/admin/products/' + productId, {
          method: 'DELETE',
          headers: headers()
        });
        const data = await res.json();
        if (!res.ok) {
          return alert(data.error || 'Erro ao excluir produto');
        }
        await loadProducts();
      }

      async function createNewProduct() {
        const name = document.getElementById('newName').value.trim();
        const price = Number(document.getElementById('newPrice').value);
        const size = document.getElementById('newSize').value;
        const stock = Number(document.getElementById('newStock').value);
        const msg = document.getElementById('newProductMsg');
        msg.textContent = '';

        if (!name) return alert('Informe o nome do produto');
        if (!Number.isFinite(price) || price <= 0) return alert('Preço inválido');
        if (!Number.isInteger(stock) || stock < 0) return alert('Quantidade inválida');

        const res = await fetch('/admin/products', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            name,
            price,
            stock,
            size,
            description: 'Torcedor masculina',
            active: true
          })
        });
        const data = await res.json();
        if (!res.ok) {
          msg.textContent = data.error || 'Erro ao criar produto';
          msg.className = 'bad';
          return;
        }
        msg.textContent = 'Produto criado com ID #' + data.product.id;
        msg.className = 'ok';
        document.getElementById('newName').value = '';
        document.getElementById('newPrice').value = '';
        document.getElementById('newStock').value = '';
        await loadProducts();
      }

      async function loadAll() {
        try {
          await loadOrders();
          await loadDeliveries();
          await loadProducts();
        } catch (err) {
          alert(err.message);
        }
      }

      (function boot() {
        const tokenInput = document.getElementById('token');
        tokenInput.value = '';
        setDashboardVisible(false);
        collapseAllSections();
        if (window.location.search) {
          window.history.replaceState({}, document.title, '/admin/panel');
        }
        document.addEventListener('keydown', function onSlashFocus(event) {
          if (event.key !== '/') return;
          const tag = document.activeElement?.tagName?.toLowerCase();
          const editing = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
          if (editing) return;
          const search = document.getElementById('stockSearch');
          if (!search || document.getElementById('stockCard').style.display === 'none') return;
          event.preventDefault();
          setSectionExpanded('stockSection', 'stockArrow', true);
          search.focus();
        });
      })();
    </script>
  </body>
</html>`);
});

router.get('/admin/orders', adminAuth, async (req, res) => {
  try {
    await cancelExpiredPendingOrders();
    const status = req.query.status ? String(req.query.status).trim() : null;
    const orders = await listOrdersForAdmin({ status });
    return res.json({ ok: true, orders });
  } catch (err) {
    console.error('Error listing orders:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/deliveries/by-order/:id', adminAuth, async (req, res) => {
  const orderId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'order id inválido' });
  }

  try {
    let delivery = await getDeliveryByOrderId(orderId);
    if (!delivery) {
      await ensureDeliveryForOrder(orderId);
      delivery = await getDeliveryByOrderId(orderId);
    }
    if (!delivery) return res.status(404).json({ error: 'Entrega não encontrada' });
    return res.json({ ok: true, delivery });
  } catch (err) {
    console.error('Error fetching delivery details:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/deliveries', adminAuth, async (req, res) => {
  try {
    const deliveries = await listDeliveriesForAdmin();
    return res.json({ ok: true, deliveries });
  } catch (err) {
    console.error('Error listing deliveries:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.post('/admin/deliveries/:id/status', adminAuth, async (req, res) => {
  const orderId = Number.parseInt(req.params.id, 10);
  const status = req.body?.status ? String(req.body.status).trim() : '';
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'order id inválido' });
  }

  try {
    const delivery = await setDeliveryStatus(orderId, status);
    return res.json({ ok: true, delivery });
  } catch (err) {
    console.error('Error updating delivery status:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/summary', adminAuth, async (req, res) => {
  try {
    await cancelExpiredPendingOrders();
    const orders = await listOrdersForAdmin();
    const summary = orders.reduce((acc, order) => {
      acc.total += 1;
      if (order.status === 'paid') acc.paid += 1;
      else if (order.status === 'pending') acc.pending += 1;
      else if (order.status === 'cancelled') acc.cancelled += 1;
      acc.revenue_paid += order.status === 'paid' ? Number(order.total || 0) : 0;
      return acc;
    }, { total: 0, paid: 0, pending: 0, cancelled: 0, revenue_paid: 0 });

    return res.json({ ok: true, summary });
  } catch (err) {
    console.error('Error building summary:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/products', adminAuth, async (req, res) => {
  try {
    const products = await listProductsForAdmin();
    return res.json({ ok: true, products });
  } catch (err) {
    console.error('Error listing products:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.post('/admin/products', adminAuth, async (req, res) => {
  const { name, description, price, stock, size, active } = req.body || {};
  try {
    const product = await createProduct({
      name,
      description,
      price,
      stock: Number.parseInt(stock, 10),
      size: size ? String(size).trim().toUpperCase() : null,
      active,
    });
    return res.status(201).json({ ok: true, product });
  } catch (err) {
    console.error('Error creating product:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/admin/products/:id/price', adminAuth, async (req, res) => {
  const productId = Number.parseInt(req.params.id, 10);
  const price = Number(req.body?.price);

  if (!Number.isInteger(productId)) {
    return res.status(400).json({ error: 'product id inválido' });
  }

  try {
    const product = await updateProductPrice(productId, price);
    return res.json({ ok: true, product });
  } catch (err) {
    console.error('Error updating price:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/admin/products/:id/stock-total', adminAuth, async (req, res) => {
  const productId = Number.parseInt(req.params.id, 10);
  const stock = Number.parseInt(req.body?.stock, 10);

  if (!Number.isInteger(productId)) {
    return res.status(400).json({ error: 'product id inválido' });
  }

  try {
    const product = await updateProductTotalStock(productId, stock);
    return res.json({ ok: true, product });
  } catch (err) {
    console.error('Error updating total stock:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/admin/products/:id', adminAuth, async (req, res) => {
  const productId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(productId)) {
    return res.status(400).json({ error: 'product id inválido' });
  }

  try {
    const product = await deactivateProduct(productId);
    return res.json({ ok: true, product });
  } catch (err) {
    console.error('Error deleting product:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/admin/products/:id/stock', adminAuth, async (req, res) => {
  const productId = Number.parseInt(req.params.id, 10);
  const mode = req.body?.mode === 'set' ? 'set' : 'increment';
  const amount = Number.parseInt(req.body?.amount, 10);
  const size = req.body?.size ? String(req.body.size).trim().toUpperCase() : null;

  if (!Number.isInteger(productId)) {
    return res.status(400).json({ error: 'product id inválido' });
  }
  if (!Number.isInteger(amount)) {
    return res.status(400).json({ error: 'amount deve ser inteiro' });
  }

  try {
    const product = await adjustProductStock(productId, { mode, amount, size });
    return res.json({ ok: true, product });
  } catch (err) {
    console.error('Error updating stock:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.post('/admin/payments/confirm', adminAuth, async (req, res) => {
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  try {
    const result = await confirmPayment(order_id);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error confirming payment:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
