'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cartTotal } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { createOrder, quoteShipping } from '@/lib/api';

// Recargo informativo de Mercado Pago para mostrarle al comprador antes de
// pagar. El monto real que se cobra siempre lo calcula el backend (ver
// orders.service.ts) — esto es solo una previsualización.
const MP_SURCHARGE_PERCENT = Number(process.env.NEXT_PUBLIC_MP_SURCHARGE_PERCENT ?? '4.3');
import { isValidDniOrCuit } from '@/lib/dni-cuit';
import {
  fetchArgentinaProvinces,
  fetchProvinceCities,
  fetchStreetSuggestions,
  type ArgentinaCityOption,
  type ArgentinaProvinceOption,
  type ArgentinaStreetOption,
} from '@/lib/argentina-addresses';

interface ShippingQuote {
  sucursal: number;
  domicilio: number;
  estimatedDays: number;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items: cart, clear } = useCart();
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<ArgentinaProvinceOption[]>([]);
  const [provinceCities, setProvinceCities] = useState<ArgentinaCityOption[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [provinceQuery, setProvinceQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [streetQuery, setStreetQuery] = useState('');
  const [provinceMenuOpen, setProvinceMenuOpen] = useState(false);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [streetMenuOpen, setStreetMenuOpen] = useState(false);
  const [streetSuggestions, setStreetSuggestions] = useState<ArgentinaStreetOption[]>([]);
  const [loadingStreetSuggestions, setLoadingStreetSuggestions] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedCityCensalId, setSelectedCityCensalId] = useState('');

  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    buyerDni: '',
    shippingStreet: '',
    shippingNumber: '',
    shippingCity: '',
    shippingState: '',
    shippingPartido: '',
    shippingZip: '',
    shippingMethod: 'DOMICILIO' as 'SUCURSAL' | 'DOMICILIO',
    paymentMethod: 'MERCADOPAGO' as 'MERCADOPAGO' | 'TRANSFERENCIA',
  });

  useEffect(() => {
    let active = true;

    async function loadProvinces() {
      setLoadingProvinces(true);
      try {
        const data = await fetchArgentinaProvinces();
        if (active) setProvinces(data);
      } catch {
        if (active) setProvinces([]);
      } finally {
        if (active) setLoadingProvinces(false);
      }
    }

    loadProvinces();

    return () => {
      active = false;
    };
  }, []);

  const selectedProvince = useMemo(
    () => provinces.find((province) => province.province === form.shippingState),
    [form.shippingState, provinces]
  );

  useEffect(() => {
    const selected = provinces.find((province) => province.province === form.shippingState);
    setProvinceQuery(selected ? selected.province : '');
  }, [form.shippingState, provinces]);

  useEffect(() => {
    const selected = provinceCities.find((city) => city.city === form.shippingCity);
    setCityQuery(selected ? selected.city : '');
    setSelectedCityId(selected ? selected.id : '');
    setSelectedCityCensalId(selected ? selected.censalId : '');
  }, [form.shippingCity, provinceCities]);

  useEffect(() => {
    const provinceId = selectedProvince?.id ?? '';

    if (!provinceId) {
      setProvinceCities([]);
      setLoadingCities(false);
      return;
    }

    let active = true;

    async function loadCities() {
      setLoadingCities(true);
      try {
        const cities = await fetchProvinceCities(provinceId);
        if (active) setProvinceCities(cities);
      } catch {
        if (active) setProvinceCities([]);
      } finally {
        if (active) setLoadingCities(false);
      }
    }

    loadCities();

    return () => {
      active = false;
    };
  }, [selectedProvince]);

  const filteredProvinces = useMemo(() => {
    const query = provinceQuery.trim().toLowerCase();
    if (!query) return provinces;
    return provinces.filter((province) => province.province.toLowerCase().includes(query));
  }, [provinceQuery, provinces]);

  const filteredCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    if (!query) return provinceCities;
    return provinceCities.filter((city) => city.city.toLowerCase().includes(query));
  }, [cityQuery, provinceCities]);

  useEffect(() => {
    const censalId = selectedCityCensalId;

    if (!censalId || streetQuery.trim().length < 2) {
      setStreetSuggestions([]);
      setLoadingStreetSuggestions(false);
      return;
    }

    let active = true;
    setLoadingStreetSuggestions(true);

    // Espera a que se deje de tipear antes de consultar la API: evita
    // disparar un request por cada letra mientras se escribe la calle.
    const timer = setTimeout(async () => {
      try {
        const suggestions = await fetchStreetSuggestions(censalId, streetQuery);
        if (active) {
          setStreetSuggestions(suggestions);
        }
      } catch {
        if (active) setStreetSuggestions([]);
      } finally {
        if (active) setLoadingStreetSuggestions(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedCityCensalId, streetQuery]);

  async function quoteForDestination(province: string, partido: string) {
    if (!province) {
      setShippingQuote(null);
      return;
    }
    try {
      const quote = await quoteShipping(province, partido, cartTotal(cart));
      setShippingQuote(quote);
    } catch {
      setShippingQuote(null);
    }
  }

  function handleProvinceSelect(option: string) {
    setForm((f) => ({ ...f, shippingState: option, shippingCity: '', shippingPartido: '', shippingZip: '' }));
    setProvinceQuery(option);
    setProvinceMenuOpen(false);
    setCityQuery('');
    setSelectedCityId('');
    setSelectedCityCensalId('');
    setStreetQuery('');
    setStreetSuggestions([]);
    quoteForDestination(option, '');
  }

  function handleCitySelect(option: string) {
    const selected = provinceCities.find((city) => city.city === option);
    const partido = selected?.partido ?? '';
    setForm((f) => ({ ...f, shippingCity: option, shippingPartido: partido, shippingZip: '' }));
    setCityQuery(option);
    setCityMenuOpen(false);
    setSelectedCityId(selected?.id ?? '');
    setSelectedCityCensalId(selected?.censalId ?? '');
    setStreetQuery('');
    setStreetSuggestions([]);
    quoteForDestination(form.shippingState, partido);
  }

  function handleStreetSelect(option: string) {
    setForm((f) => ({ ...f, shippingStreet: option }));
    setStreetQuery(option);
    setStreetMenuOpen(false);
  }

  function update(field: string, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };

      if (field === 'shippingState') {
        next.shippingCity = '';
        next.shippingPartido = '';
        next.shippingZip = '';
        setSelectedCityId('');
        setSelectedCityCensalId('');
      }

      if (field === 'shippingCity') {
        next.shippingZip = '';
      }

      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCityId) {
      setError('Seleccioná una ciudad válida antes de continuar');
      return;
    }
    if (!isValidDniOrCuit(form.buyerDni)) {
      setError('El DNI o CUIT ingresado no es válido');
      return;
    }
    setError(null);
    setShowConfirm(true);
  }

  async function handleConfirmPurchase() {
    setLoading(true);
    setError(null);
    try {
      const result = await createOrder({
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        ...form,
      });

      if (result.payment.method === 'TRANSFERENCIA') {
        clear();
        router.push(`/checkout/transferencia?orderId=${result.order?.id}`);
        return;
      }

      window.location.href = result.payment.initPoint;
    } catch (err: any) {
      setError(err.message || 'Error al crear la orden');
      setLoading(false);
      setShowConfirm(false);
    }
  }

  if (cart.length === 0) {
    return <p>El carrito está vacío.</p>;
  }

  const shippingCost = shippingQuote ? shippingQuote[form.shippingMethod.toLowerCase() as 'sucursal' | 'domicilio'] : null;
  const total = cartTotal(cart) + (shippingCost ?? 0);
  const mpSurchargeAmount = total * (MP_SURCHARGE_PERCENT / 100);
  const displayTotal = form.paymentMethod === 'MERCADOPAGO' ? total + mpSurchargeAmount : total;

  return (
    <div>
      <h1>Checkout</h1>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Nombre y apellido"
          value={form.buyerName}
          onChange={(e) => update('buyerName', e.target.value)}
          required
        />
        <input
          placeholder="Email"
          type="email"
          value={form.buyerEmail}
          onChange={(e) => update('buyerEmail', e.target.value)}
          required
        />
        <input
          placeholder="Teléfono"
          value={form.buyerPhone}
          onChange={(e) => update('buyerPhone', e.target.value)}
          required
        />
        <input
          placeholder="DNI o CUIT"
          value={form.buyerDni}
          onChange={(e) => update('buyerDni', e.target.value)}
          required
        />

        <label>
          Provincia
          <div className="search-select">
            <input
              value={provinceQuery}
              onChange={(e) => {
                setProvinceQuery(e.target.value);
                setProvinceMenuOpen(true);
              }}
              onFocus={() => setProvinceMenuOpen(true)}
              onBlur={() => setProvinceMenuOpen(false)}
              placeholder={loadingProvinces ? 'Cargando provincias...' : 'Buscar provincia'}
              disabled={loadingProvinces}
              required
            />
            {provinceMenuOpen && !loadingProvinces && filteredProvinces.length > 0 && (
              <ul className="search-options">
                {filteredProvinces.map((province) => (
                  <li key={province.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleProvinceSelect(province.province);
                      }}
                    >
                      {province.province}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>

        <label>
          Ciudad
          <div className="search-select">
            <input
              value={cityQuery}
              onChange={(e) => {
                setCityQuery(e.target.value);
                setCityMenuOpen(true);
                setSelectedCityId('');
                setSelectedCityCensalId('');
                setStreetQuery('');
                setStreetSuggestions([]);
                setForm((f) => ({ ...f, shippingCity: '', shippingPartido: '', shippingStreet: '', shippingZip: '' }));
              }}
              onFocus={() => setCityMenuOpen(true)}
              onBlur={() => setCityMenuOpen(false)}
              placeholder={!form.shippingState ? 'Elegí una provincia primero' : loadingCities ? 'Cargando ciudades...' : 'Buscar ciudad'}
              disabled={!form.shippingState || loadingCities}
              required
            />
            {cityMenuOpen && form.shippingState && !loadingCities && filteredCities.length > 0 && (
              <ul className="search-options">
                {filteredCities.map((city) => (
                  <li key={city.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCitySelect(city.city);
                      }}
                    >
                      {city.city}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>

        <label>
          Calle
          <div className="search-select">
            <input
              value={streetQuery || form.shippingStreet}
              onChange={(e) => {
                setStreetQuery(e.target.value);
                setStreetMenuOpen(true);
                if (!e.target.value) {
                  setForm((f) => ({ ...f, shippingStreet: '' }));
                  setStreetSuggestions([]);
                } else {
                  setForm((f) => ({ ...f, shippingStreet: e.target.value }));
                }
              }}
              onFocus={() => setStreetMenuOpen(true)}
              onBlur={() => setStreetMenuOpen(false)}
              placeholder={!selectedCityId ? 'Elegí una ciudad primero' : loadingStreetSuggestions ? 'Buscando calles...' : 'Buscar calle'}
              required
              disabled={!selectedCityId}
            />
            {streetMenuOpen && selectedCityId && streetSuggestions.length > 0 && (
              <ul className="search-options">
                {streetSuggestions.map((street) => (
                  <li key={street.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStreetSelect(street.name);
                      }}
                    >
                      {street.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
        <input
          placeholder="Número"
          value={form.shippingNumber}
          onChange={(e) => update('shippingNumber', e.target.value)}
          required
          disabled={!selectedCityId}
        />

        <label>
          Código postal
          <input
            placeholder="Código postal"
            value={form.shippingZip}
            onChange={(e) => update('shippingZip', e.target.value)}
            required
            disabled={!selectedCityId}
          />
        </label>

        {shippingQuote && (
          <>
            <p className="option-group-label">Método de envío</p>
            <div className="option-list">
              <label className={`option-row${form.shippingMethod === 'DOMICILIO' ? ' selected' : ''}`}>
                <span className="option-main">
                  <input
                    type="radio"
                    name="shippingMethod"
                    checked={form.shippingMethod === 'DOMICILIO'}
                    onChange={() => update('shippingMethod', 'DOMICILIO')}
                  />
                  <span className="option-label">Envío a domicilio</span>
                </span>
                <span className="option-price">
                  {shippingQuote.domicilio > 0 ? formatMoney(shippingQuote.domicilio) : 'Gratis'}
                </span>
              </label>
              <label className={`option-row${form.shippingMethod === 'SUCURSAL' ? ' selected' : ''}`}>
                <span className="option-main">
                  <input
                    type="radio"
                    name="shippingMethod"
                    checked={form.shippingMethod === 'SUCURSAL'}
                    onChange={() => update('shippingMethod', 'SUCURSAL')}
                  />
                  <span className="option-label">Retiro en sucursal</span>
                </span>
                <span className="option-price">
                  {shippingQuote.sucursal > 0 ? formatMoney(shippingQuote.sucursal) : 'Gratis'}
                </span>
              </label>
            </div>
          </>
        )}

        <p className="option-group-label">Método de pago</p>
        <div className="option-list">
          <label className={`option-row${form.paymentMethod === 'MERCADOPAGO' ? ' selected' : ''}`}>
            <span className="option-main">
              <input
                type="radio"
                name="paymentMethod"
                checked={form.paymentMethod === 'MERCADOPAGO'}
                onChange={() => update('paymentMethod', 'MERCADOPAGO')}
              />
              <span>
                <span className="option-label">Mercado Pago</span>
                <span className="option-hint">Tarjeta, dinero en cuenta, etc.</span>
              </span>
            </span>
            <span className="option-price">+{formatMoney(mpSurchargeAmount)}</span>
          </label>
          <label className={`option-row${form.paymentMethod === 'TRANSFERENCIA' ? ' selected' : ''}`}>
            <span className="option-main">
              <input
                type="radio"
                name="paymentMethod"
                checked={form.paymentMethod === 'TRANSFERENCIA'}
                onChange={() => update('paymentMethod', 'TRANSFERENCIA')}
              />
              <span>
                <span className="option-label">Transferencia bancaria</span>
                <span className="option-hint">Te mostramos el CBU al confirmar</span>
              </span>
            </span>
            <span className="option-price">Sin recargo</span>
          </label>
        </div>

        <div className="price-breakdown">
          <div className="price-breakdown-row">
            <span>Productos</span>
            <span>{formatMoney(cartTotal(cart))}</span>
          </div>
          <div className="price-breakdown-row">
            <span>Envío</span>
            <span>{shippingCost ? formatMoney(shippingCost) : shippingCost === 0 ? 'Gratis' : '—'}</span>
          </div>
          {form.paymentMethod === 'MERCADOPAGO' && (
            <div className="price-breakdown-row">
              <span>Recargo Mercado Pago ({MP_SURCHARGE_PERCENT}%)</span>
              <span>{formatMoney(mpSurchargeAmount)}</span>
            </div>
          )}
        </div>

        <div className="total-row">
          <span>Total</span>
          <span>{formatMoney(displayTotal)}</span>
        </div>

        {error && <p style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading
            ? 'Procesando...'
            : form.paymentMethod === 'MERCADOPAGO'
              ? 'Pagar con Mercado Pago'
              : 'Continuar con transferencia'}
        </button>
      </form>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => !loading && setShowConfirm(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>Confirmá tus datos</h2>
            <p className="modal-eyebrow">
              {form.paymentMethod === 'MERCADOPAGO'
                ? 'Revisá que todo esté correcto antes de ir a Mercado Pago'
                : 'Revisá que todo esté correcto antes de generar el pedido'}
            </p>

            <dl className="modal-summary">
              <dt>Comprador</dt>
              <dd>{form.buyerName}</dd>
              <dt>Contacto</dt>
              <dd>{form.buyerEmail} · {form.buyerPhone}</dd>
              <dt>DNI / CUIT</dt>
              <dd>{form.buyerDni}</dd>
              <dt>Envío</dt>
              <dd>
                {form.shippingStreet} {form.shippingNumber}, {form.shippingCity}, {form.shippingState} (
                {form.shippingZip})
              </dd>
              <dt>Método de envío</dt>
              <dd>
                {form.shippingMethod === 'DOMICILIO' ? 'Envío a domicilio' : 'Retiro en sucursal'}
                {shippingCost !== null && (shippingCost > 0 ? ` — ${formatMoney(shippingCost)}` : ' — Gratis')}
              </dd>
              <dt>Método de pago</dt>
              <dd>
                {form.paymentMethod === 'MERCADOPAGO'
                  ? `Mercado Pago (recargo del ${MP_SURCHARGE_PERCENT}% incluido)`
                  : 'Transferencia bancaria (sin recargo)'}
              </dd>
            </dl>

            <div className="modal-items">
              {cart.map((item) => (
                <div className="modal-item-row" key={item.productId}>
                  <span className="name">{item.name}</span>
                  <span className="qty">
                    {item.quantity} × {formatMoney(item.price)}
                  </span>
                </div>
              ))}
            </div>

            <div className="price-breakdown">
              <div className="price-breakdown-row">
                <span>Productos</span>
                <span>{formatMoney(cartTotal(cart))}</span>
              </div>
              <div className="price-breakdown-row">
                <span>Envío</span>
                <span>{shippingCost ? formatMoney(shippingCost) : shippingCost === 0 ? 'Gratis' : '—'}</span>
              </div>
              {form.paymentMethod === 'MERCADOPAGO' && (
                <div className="price-breakdown-row">
                  <span>Recargo Mercado Pago ({MP_SURCHARGE_PERCENT}%)</span>
                  <span>{formatMoney(mpSurchargeAmount)}</span>
                </div>
              )}
            </div>

            <div className="total-row">
              <span>Total</span>
              <span>{formatMoney(displayTotal)}</span>
            </div>

            {error && (
              <p style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => setShowConfirm(false)} disabled={loading}>
                Volver
              </button>
              <button type="button" className="btn-primary" onClick={handleConfirmPurchase} disabled={loading}>
                {loading ? 'Procesando...' : 'Confirmar y pagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
