// src/pages/Shop.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, setDoc, getDoc, onSnapshot, collection } from "firebase/firestore";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth <= 600;
}

export default function Shop() {
  const [showCartNotice, setShowCartNotice] = useState(false);
  const { slug } = useParams(); // ✅ capture /:slug if present
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [addedMessage, setAddedMessage] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  // --- helper: haversine + driving-time estimate ---
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const estimateDriving = (straightKm) => {
    const drivingMultiplier = 1.64;
    const avgSpeedKmh = 25;
    const drivingKm = straightKm * drivingMultiplier;
    const minutes = Math.max(1, Math.round((drivingKm / avgSpeedKmh) * 60));
    return { drivingKm, minutes };
  };

  // --- Get user location once ---
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        // Save to Firestore if user is logged in
        const authUser = auth.currentUser;
        if (authUser) {
          const userRef = doc(db, "users", authUser.uid);
          // Only update if customer (not business/agent)
          getDoc(userRef).then((snap) => {
            const data = snap.data();
            if (data && data.role === "customer") {
              // Save lat/lng to user doc
              setDoc(userRef, { lat: coords.lat, lng: coords.lng }, { merge: true });
            }
          });
        }
      },
      () => setUserLocation("denied")
    );
  }, [auth]);

  // --- Auth + cart listener ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, [auth]);

  // --- Get all products ---
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "products"), async (snapshot) => {
      const items = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() };
          if (data.ownerId) {
            const businessRef = doc(db, "users", data.ownerId);
            const bizSnap = await getDoc(businessRef);
            if (bizSnap.exists()) {
              const bizData = bizSnap.data();
              data.businessName = bizData.businessName || "Unknown Pharmacy";
              data.ownerSlug = bizData.slug || null;
              data.ownerRole = bizData.role || null;
              if (bizData.location?.latitude && bizData.location?.longitude) {
                data.businessLat = bizData.location.latitude;
                data.businessLng = bizData.location.longitude;
              }
              data.businessState = bizData.businessState || bizData.state || "";
            }
          }
          return data;
        })
      );
      // Hide products added by distributors
      const filtered = items.filter((p) => p.ownerRole !== "distributor");
      setProducts(filtered);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // --- Group, filter, sort ---
  useEffect(() => {
    if (products.length === 0) return;

    // ✅ If a slug exists → only show that business
    let filteredBySlug = slug
      ? products.filter((p) => p.ownerSlug === slug)
      : products;
    // Filter by selected state if set
    if (selectedState) {
      filteredBySlug = filteredBySlug.filter(p => p.businessState === selectedState);
    }

    const grouped = {};
    for (const p of filteredBySlug) {
      const key = (p.normalizedName || p.name || "").toLowerCase().trim();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    }

    const finalArr = Object.values(grouped)
      .map((group) => {
        if (userLocation && userLocation !== "denied") {
          group = group.map((p) => {
            if (p.businessLat && p.businessLng) {
              const straightKm = haversineKm(
                userLocation.lat,
                userLocation.lng,
                p.businessLat,
                p.businessLng
              );
              const { minutes } = estimateDriving(straightKm);
              return { ...p, minutesAway: minutes };
            }
            return { ...p, minutesAway: Infinity };
          });
          group.sort((a, b) => a.minutesAway - b.minutesAway);
        }
        return group;
      })
      .flat();

    // --- Search logic (same as before) ---
    const normalizeText = (txt = "") =>
      txt.toLowerCase().trim().replace(/\s+/g, " ");
    const drugSynonyms = {
      pcm: "paracetamol",
      flagyl: "metronidazole",
      vit: "vitamin",
      ibucap: "ibuprofen",
      amox: "amoxicillin",
      diclo: "diclofenac",
      cipro: "ciprofloxacin",
      emzor: "paracetamol",
      fever: "paracetamol antipyretic",
      pain: "analgesic ibuprofen diclofenac paracetamol",
      headache: "paracetamol ibuprofen analgesic",
      infection: "antibiotic amoxicillin ciprofloxacin metronidazole",
      cough: "cough-suppressant expectorant syrup",
      cold: "decongestant antihistamine vitamin",
      flu: "antihistamine decongestant vitamin",
      malaria: "antimalarial artemether lumefantrine",
      stomach: "antacid omeprazole metronidazole",
      ulcer: "omeprazole antacid pantoprazole",
      diarrhea: "antidiarrheal loperamide",
      worm: "deworming mebendazole albendazole",
      allergy: "antihistamine loratadine cetirizine",
      inflammation: "anti-inflammatory ibuprofen diclofenac",
      hypertension: "antihypertensive amlodipine lisinopril",
      diabetes: "metformin insulin antidiabetic",
    };

    const lower = normalizeText(searchTerm);
    const expandedTerms = (drugSynonyms[lower] || lower).split(" ");
    const fuzzyMatch = (text, term) =>
      text.includes(term) ||
      (term.length > 3 && text.startsWith(term.slice(0, 3))) ||
      (term.length > 3 && text.endsWith(term.slice(-3)));

    const filtered = finalArr.filter((p) => {
      const name = normalizeText(p.name);
      const ingredient = normalizeText(p.ingredient);
      const drugClass = normalizeText(p.class);
      return expandedTerms.some(
        (term) =>
          name.includes(term) ||
          ingredient.includes(term) ||
          drugClass.includes(term) ||
          fuzzyMatch(name, term) ||
          fuzzyMatch(ingredient, term) ||
          fuzzyMatch(drugClass, term)
      );
    });

    setDisplayProducts(filtered);
  }, [products, userLocation, searchTerm, slug]);

  // --- Add to cart (unchanged) ---
  const addToCart = async (item) => {
    if (!user) return alert("Please log in first");
    // Attach businessPhone and businessWhatsapp to item if available
    let itemWithContacts = { ...item };
    if (!itemWithContacts.businessPhone || !itemWithContacts.businessWhatsapp) {
      // Try to fetch from business user doc
      if (itemWithContacts.ownerId) {
        try {
          const businessRef = doc(db, "users", itemWithContacts.ownerId);
          const bizSnap = await getDoc(businessRef);
          if (bizSnap.exists()) {
            const bizData = bizSnap.data();
            itemWithContacts.businessPhone = bizData.businessPhone || "";
            itemWithContacts.businessWhatsapp = bizData.businessWhatsapp || "";
          }
        } catch (e) { /* ignore */ }
      }
    }
    const cartRef = doc(db, "carts", user.uid);
    const cartSnap = await getDoc(cartRef);
    let newCart = cartSnap.exists() ? cartSnap.data().items || [] : [];
    const index = newCart.findIndex((i) => i.name === itemWithContacts.name);
    if (index >= 0) newCart[index].quantity += 1;
    else newCart.push({ ...itemWithContacts, quantity: 1 });
    await setDoc(cartRef, { items: newCart });
    setAddedMessage(item.id);
    setShowCartNotice(true);
    setTimeout(() => setShowCartNotice(false), 1800);
    setTimeout(() => setAddedMessage(null), 1000);
  };

  console.log("Visible medicines:", displayProducts.map(p => p.businessName));

  // --- UI ---
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f4f6fb 0%, #e0e7ff 100%)',
      padding: isMobile() ? '10px 2vw' : '30px',
      position: 'relative',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      {showCartNotice && (
        <div style={{
          position: 'fixed',
          top: '30px',
          right: '30px',
          background: '#7c3aed',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '10px',
          boxShadow: '0 2px 12px rgba(124,58,237,0.15)',
          fontWeight: 'bold',
          fontSize: '16px',
          zIndex: 2000,
          opacity: 0.97,
          transition: 'opacity 0.3s',
        }}>
          Added to cart! <a href="/cart" style={{ color: '#fff', textDecoration: 'underline', marginLeft: 10 }}>View Cart</a>
        </div>
      )}

      <h2 style={{ fontWeight: 800, color: '#2d3748', fontSize: isMobile() ? 22 : 32, marginBottom: 8, letterSpacing: 1 }}>
        🩺 {slug ? `${slug}'s Pharmacy` : "All Medicine Listings"}
      </h2>
      {!slug && (
        <div style={{ color: '#6366f1', fontSize: 18, marginBottom: 18, fontWeight: 500 }}>
          Browse and compare all medications. Sort by closest to you and price.
        </div>
      )}

      {/* Sticky search/filter bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: isMobile() ? 8 : 16, margin: isMobile() ? '8px 0' : '15px 0',
        position: 'sticky', top: 0, zIndex: 10, background: 'rgba(244,246,251,0.95)', padding: isMobile() ? '6px 0' : '12px 0', borderRadius: 12, boxShadow: '0 2px 8px #c7d2fe22'
      }}>
        <input
          type="text"
          placeholder="Search medicines, ingredients, or class..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: isMobile() ? '8px' : '12px',
            width: '100%',
            maxWidth: isMobile() ? '98vw' : '400px',
            borderRadius: '10px',
            border: '1.5px solid #b3b3e7',
            fontSize: isMobile() ? 15 : 17,
            background: '#f9f9ff',
            boxShadow: '0 1px 4px #c7d2fe22',
          }}
        />
        <select
          value={selectedState}
          onChange={e => setSelectedState(e.target.value)}
          style={{
            padding: isMobile() ? '8px' : '12px',
            borderRadius: 10,
            border: '1.5px solid #b3b3e7',
            fontSize: isMobile() ? 15 : 17,
            minWidth: isMobile() ? 120 : 180,
            background: '#f9f9ff',
            color: '#222',
            outline: 'none',
            boxShadow: '0 1px 4px #c7d2fe22',
          }}
        >
          <option value="">Sort by state</option>
          {NIGERIAN_STATES.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </div>

      {/* Loader */}
      {loading ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <div className="loader" style={{
            width: 48, height: 48, border: '5px solid #e0e7ff', borderTop: '5px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: 'auto'
          }} />
          <style>{`@keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }`}</style>
        </div>
      ) : displayProducts.length === 0 ? (
        <p style={{ color: "gray", marginTop: 40, fontSize: 18 }}>
          {slug
            ? "No medicines found for this pharmacy. Please check the link or select a valid business."
            : "No medicines found."}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile() ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
            gap: isMobile() ? '14px' : '28px',
            marginTop: 18,
          }}
        >
          {displayProducts.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1.5px solid #e0e7ff",
                padding: isMobile() ? '10px 6px 10px 6px' : '18px 16px 16px 16px',
                borderRadius: "16px",
                background: "#fff",
                boxShadow: "0 2px 12px #c7d2fe22",
                position: "relative",
                minHeight: isMobile() ? '180px' : '240px',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'pointer',
                willChange: 'transform',
                display: 'flex', flexDirection: 'column', alignItems: 'stretch',
              }}
              onMouseEnter={e => { if (!isMobile()) { e.currentTarget.style.boxShadow = '0 8px 32px #6366f133'; e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)'; } }}
              onMouseLeave={e => { if (!isMobile()) { e.currentTarget.style.boxShadow = '0 2px 12px #c7d2fe22'; e.currentTarget.style.transform = 'none'; } }}
            >
              {/* Registered Only Badge */}
              {p.registeredOnly && (
                <span style={{
                  position: "absolute", top: "10px", left: "10px",
                  background: "#7c3aed", color: "#fff", padding: "2px 10px",
                  borderRadius: "16px", fontSize: "13px", fontWeight: "bold",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)", letterSpacing: "1px",
                  display: 'inline-block', minWidth: 80, textAlign: 'center',
                }}>Registered Only</span>
              )}
              {/* POM Badge */}
              {p.isPOM && (
                <span style={{
                  position: "absolute", top: p.registeredOnly ? "38px" : "10px", left: "10px",
                  background: "#e53935", color: "#fff", padding: "2px 10px",
                  borderRadius: "16px", fontSize: "13px", fontWeight: "bold",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)", letterSpacing: "1px",
                  display: 'inline-block', minWidth: 40, textAlign: 'center',
                }}>POM</span>
              )}
              {/* Product Image or Fallback */}
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.name}
                  style={{
                    width: "100%",
                    height: isMobile() ? '90px' : '150px',
                    objectFit: "cover",
                    borderRadius: "10px",
                    marginBottom: isMobile() ? '6px' : '10px',
                    background: '#f4f6fb',
                  }}
                  onError={e => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300x150?text=No+Image'; }}
                />
              ) : (
                <div style={{
                  width: '100%', height: isMobile() ? 90 : 150, borderRadius: 10, marginBottom: isMobile() ? 6 : 10,
                  background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b3b3e7', fontSize: isMobile() ? 16 : 22, fontWeight: 700
                }}>
                  No Image
                </div>
              )}
              <strong style={{ fontSize: 19, color: '#2d3748', marginBottom: 2 }}>{p.name || "Unnamed Drug"}</strong>
              <p style={{ fontSize: 15, color: '#6366f1', margin: 0 }}><em>{p.ingredient || "No ingredient listed"}</em></p>
              <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Class: {p.class || "No class listed"}</p>
              <p style={{ fontSize: 16, color: '#059669', fontWeight: 700, margin: '6px 0 0 0' }}>₦{p.price !== undefined ? p.price : "N/A"}</p>
              <p style={{ fontSize: "0.95em", color: "#555", margin: '6px 0 0 0' }}>
                🏥 {p.ownerSlug ? (
                  <a
                    href={`/store/${p.ownerSlug}`}
                    style={{ color: '#7c3aed', textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
                  >
                    {p.businessName && p.businessName.trim() ? p.businessName : "Unknown Pharmacy"}
                  </a>
                ) : (
                  p.businessName && p.businessName.trim() ? p.businessName : "Unknown Pharmacy"
                )}
              </p>
              <button
                onClick={() => addToCart(p)}
                style={{
                  marginTop: "12px",
                  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  boxShadow: '0 2px 8px #6366f122', transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
                onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
                disabled={typeof addToCart !== "function"}
              >
                Add to Cart
              </button>
              {p.minutesAway && p.minutesAway !== Infinity && (
                <p style={{ color: "#059669", fontWeight: "600", margin: '8px 0 0 0' }}>
                  {p.minutesAway <= 1
                    ? "📍 Right here"
                    : `💨 ~${p.minutesAway} mins away`}
                </p>
              )}
              {addedMessage === p.id && (
                <span
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "#059669",
                    color: "#fff",
                    padding: "3px 10px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Added!
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
