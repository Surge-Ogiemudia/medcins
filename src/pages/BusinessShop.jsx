// src/pages/BusinessShop.jsx
import React from "react";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function BusinessShop() {
  // Track last seen order IDs to avoid duplicate notifications
  const [lastOrderIds, setLastOrderIds] = useState([]);
  const [showCartNotice, setShowCartNotice] = useState(false);
  // Floating Talk to Pharmacist button
  const PharmacistButton = () => {
    if (!business?.pharmacist) return null;
    const { name, photo, whatsapp } = business.pharmacist;
    return (
      <button
        onClick={() => {
          if (whatsapp) {
            window.open(`https://wa.me/${whatsapp}`, '_blank');
          }
        }}
        style={{
          position: 'fixed',
          top: '80px',
          right: '32px',
          background: '#fff',
          color: '#7c3aed',
          border: '1px solid #7c3aed',
          borderRadius: '50px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          padding: '4px 10px 4px 8px',
          fontWeight: 'bold',
          fontSize: '13px',
          zIndex: 1000,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s',
          opacity: 0.96,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
        onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.18)'}
        onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)'}
      >
        {photo && (
          <img src={photo} alt={name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', marginRight: 6 }} />
        )}
        Talk to {name}
      </button>
    );
  };
  const [user, setUser] = useState(null);
  const [addedMessage, setAddedMessage] = useState(null);
  const auth = getAuth();
  const { slug } = useParams(); // e.g., sugarpharmacy
  const [business, setBusiness] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userLocation, setUserLocation] = useState(null);

  // --- Helper: haversine + driving-time estimate ---
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
    const drivingMultiplier = 1.64; // accounts for road curvature
    const avgSpeedKmh = 25; // typical urban speed
    const drivingKm = straightKm * drivingMultiplier;
    const minutes = Math.max(1, Math.round((drivingKm / avgSpeedKmh) * 60));
    return { drivingKm, minutes };
  };

  // --- Get user location ---
  // --- Auth listener ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, [auth]);

  // Real-time notification for new orders containing this business's products
  useEffect(() => {
    if (!business) return;
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Find orders with at least one item owned by this business
      const relevantOrders = orders.filter(order =>
        Array.isArray(order.items) && order.items.some(item => item.ownerId === business.uid)
      );
      // Only notify for new orders
      const newOrders = relevantOrders.filter(order => !lastOrderIds.includes(order.id));
      if (newOrders.length > 0) {
        newOrders.forEach(order => {
          toast.info(`🛒 New order received! Order ID: ${order.id}`);
        });
        setLastOrderIds(prev => [...prev, ...newOrders.map(o => o.id)]);
      }
    });
    return () => unsub();
  }, [business, lastOrderIds]);
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null)
    );
  }, []);

  // --- Fetch business by slug ---
  useEffect(() => {
    if (!slug) return;

    const fetchBusiness = async () => {
      const q = query(collection(db, "users"), where("slug", "==", slug));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const bizDoc = snapshot.docs[0];
        setBusiness({ uid: bizDoc.id, ...bizDoc.data() });
      } else {
        console.warn("Business not found for slug:", slug);
        setBusiness(null);
      }
    };

    fetchBusiness();
  }, [slug]);

  // --- Fetch medicines for this business ---
  useEffect(() => {
    if (!business) return;

    const q = query(collection(db, "products"), where("ownerId", "==", business.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMedicines(items);
    });

    return () => unsub();
  }, [business]);

  // --- Search/filter + optional proximity sort ---
  useEffect(() => {
    if (!medicines) return;

    const normalizeText = (txt = "") => txt.toLowerCase().trim().replace(/\s+/g, " ");

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

    const filtered = medicines
      .map((p) => {
        // Proximity estimate if location available
        if (userLocation && business.location?.latitude && business.location?.longitude) {
          const straightKm = haversineKm(
            userLocation.lat,
            userLocation.lng,
            business.location.latitude,
            business.location.longitude
          );
          const { minutes } = estimateDriving(straightKm);
          return { ...p, minutesAway: minutes };
        }
        return { ...p, minutesAway: Infinity };
      })
      .filter((p) => {
        const name = normalizeText(p.name);
        const ingredient = normalizeText(p.ingredient);
        const drugClass = normalizeText(p.class);
        return expandedTerms.some(
          (term) =>
            name.includes(term) || ingredient.includes(term) || drugClass.includes(term)
        );
      })
      .sort((a, b) => a.minutesAway - b.minutesAway); // closest first

    setDisplayProducts(filtered);
  }, [medicines, searchTerm, userLocation, business]);

  return (
    <div style={{ padding: "30px" }}>
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
      <PharmacistButton />
      <h2>🩺 {business?.businessName || "Pharmacy"} Shop</h2>
      <p>Browse medicines below. Login only required for purchase.</p>

      {/* Pharmacist Details removed, only floating button remains */}

      <div style={{ margin: "15px 0" }}>
        <input
          type="text"
          placeholder="Search by medicine name, ingredient, or class..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "10px",
            width: "100%",
            maxWidth: "400px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      {displayProducts.length === 0 ? (
        <p>No medicines found.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {displayProducts.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #ddd",
                padding: "15px",
                borderRadius: "10px",
                background: "#fff",
                boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
                position: "relative",
                minHeight: "220px"
              }}
            >
              {p.image && (
                <img
                  src={p.image}
                  alt={p.name}
                  style={{
                    width: "100%",
                    height: "150px",
                    objectFit: "cover",
                    borderRadius: "6px",
                    marginBottom: "10px",
                  }}
                />
              )}
              <strong>{p.name || "Unnamed Drug"}</strong>
              <p><em>{p.ingredient || "No ingredient listed"}</em></p>
              <p>Class: {p.class || "No class listed"}</p>
              <p>Price: ₦{p.price !== undefined ? p.price : "N/A"}</p>
              <p style={{ fontSize: "0.9em", color: "#555" }}>
                🏥 {business?.businessName && business.businessName.trim() ? business.businessName : "Unknown Pharmacy"}
              </p>
              <button
                onClick={async () => {
                  if (!user) return alert("Please log in first");
                  const cartRef = doc(db, "carts", user.uid);
                  const cartSnap = await getDoc(cartRef);
                  let newCart = cartSnap.exists() ? cartSnap.data().items || [] : [];
                  const index = newCart.findIndex((i) => i.name === p.name);
                  if (index >= 0) newCart[index].quantity += 1;
                  else newCart.push({ ...p, quantity: 1 });
                  await setDoc(cartRef, { items: newCart });
                  setAddedMessage(p.id);
                  setShowCartNotice(true);
                  setTimeout(() => setShowCartNotice(false), 1800);
                  setTimeout(() => setAddedMessage(null), 1000);
                }}
                style={{ marginTop: "10px" }}
              >
                Add to Cart
              </button>
              {addedMessage === p.id && (
                <span
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "#4caf50",
                    color: "#fff",
                    padding: "3px 6px",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  Added!
                </span>
              )}
              {p.minutesAway !== Infinity && (
                <p style={{ color: "#4caf50", fontWeight: "500", fontSize: "0.9em" }}>
                  {p.minutesAway <= 1 ? "📍 Right here" : `💨 ~${p.minutesAway} mins away`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
