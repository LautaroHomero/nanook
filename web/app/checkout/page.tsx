'use client';

import { useEffect, useMemo, useState } from 'react';
import { cartTotal } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { createOrder, quoteShipping } from '@/lib/api';
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

export default function CheckoutPage() {
  const { items: cart } = useCart();
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

  const [form, setForm] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    shippingStreet: '',
    shippingNumber: '',
    shippingCity: '',
    shippingState: '',
    shippingZip: '',
    shippingMethod: 'DOMICILIO' as 'SUCURSAL' | 'DOMICILIO',
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

  async function quoteForProvince(province: string) {
    if (!province) {
      setShippingQuote(null);
      return;
    }
    try {
      const quote = await quoteShipping(province, cartTotal(cart));
      setShippingQuote(quote);
    } catch {
      setShippingQuote(null);
    }
  }

  function handleProvinceSelect(option: string) {
    setForm((f) => ({ ...f, shippingState: option, shippingCity: '', shippingZip: '' }));
    setProvinceQuery(option);
    setProvinceMenuOpen(false);
    setCityQuery('');
    setSelectedCityId('');
    setSelectedCityCensalId('');
    setStreetQuery('');
    setStreetSuggestions([]);
    quoteForProvince(option);
  }

  function handleCitySelect(option: string) {
    const selected = provinceCities.find((city) => city.city === option);
    setForm((f) => ({ ...f, shippingCity: option, shippingZip: '' }));
    setCityQuery(option);
    setCityMenuOpen(false);
    setSelectedCityId(selected?.id ?? '');
    setSelectedCityCensalId(selected?.censalId ?? '');
    setStreetQuery('');
    setStreetSuggestions([]);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCityId) {
      setError('Seleccioná una ciudad válida antes de continuar');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await createOrder({
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        ...form,
      });
      window.location.href = result.payment.initPoint;
    } catch (err: any) {
      setError(err.message || 'Error al crear la orden');
      setLoading(false);
    }
  }

  if (cart.length === 0) {
    return <p>El carrito está vacío.</p>;
  }

  const shippingCost = shippingQuote ? shippingQuote[form.shippingMethod.toLowerCase() as 'sucursal' | 'domicilio'] : null;
  const total = cartTotal(cart) + (shippingCost ?? 0);

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
                setForm((f) => ({ ...f, shippingCity: '', shippingStreet: '', shippingZip: '' }));
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
          <div className="shipping-method-options">
            <label>
              <input
                type="radio"
                name="shippingMethod"
                checked={form.shippingMethod === 'DOMICILIO'}
                onChange={() => update('shippingMethod', 'DOMICILIO')}
              />
              Envío a domicilio — {shippingQuote.domicilio > 0 ? `$${shippingQuote.domicilio}` : 'Gratis'}
            </label>
            <label>
              <input
                type="radio"
                name="shippingMethod"
                checked={form.shippingMethod === 'SUCURSAL'}
                onChange={() => update('shippingMethod', 'SUCURSAL')}
              />
              Retiro en sucursal — {shippingQuote.sucursal > 0 ? `$${shippingQuote.sucursal}` : 'Gratis'}
            </label>
          </div>
        )}

        <div className="total-row">
          <span>Total</span>
          <span>${total}</span>
        </div>

        {error && <p style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Procesando...' : 'Pagar con Mercado Pago'}
        </button>
      </form>
    </div>
  );
}
