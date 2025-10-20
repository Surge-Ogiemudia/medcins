// src/pages/Shop.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, setDoc, getDoc, onSnapshot, collection } from "firebase/firestore";

export default function Shop() {
  const { slug } = useParams(); // ✅ capture /:slug if present
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [addedMessage, setAddedMessage] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
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
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation("denied")
    );
  }, []);

  // --- Auth + cart listener ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, [auth]);

  // --- Get all products ---
  useEffect(() => {
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
              if (bizData.location?.latitude && bizData.location?.longitude) {
                data.businessLat = bizData.location.latitude;
                data.businessLng = bizData.location.longitude;
              }
            }
          }
          return data;
        })
      );
      setProducts(items);
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
    const cartRef = doc(db, "carts", user.uid);
    const cartSnap = await getDoc(cartRef);
    let newCart = cartSnap.exists() ? cartSnap.data().items || [] : [];
    const index = newCart.findIndex((i) => i.name === item.name);
    if (index >= 0) newCart[index].quantity += 1;
    else newCart.push({ ...item, quantity: 1 });
    await setDoc(cartRef, { items: newCart });
    setAddedMessage(item.id);
    setTimeout(() => setAddedMessage(null), 1000);
  };

  console.log("Visible medicines:", displayProducts.map(p => p.businessName));

  // --- UI ---
  return (
    <div style={{ padding: "30px", position: "relative" }}>
      <h2>
        🩺 {slug ? `${slug}'s Pharmacy` : "Pharmacy Shop"}
      </h2>

      <div style={{ margin: "15px 0" }}>
        <input
          type="text"
          placeholder="Search medicines, ingredients, or class..."
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
        <p style={{ color: "gray" }}>
          {slug
            ? "No medicines yet from this pharmacy."
            : "No medicines found."}
        </p>
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
              <strong>{p.name}</strong>
              <p><em>{p.ingredient}</em></p>
              <p>Class: {p.class}</p>
              <p>Price: ₦{p.price}</p>
              <p style={{ fontSize: "0.9em", color: "#555" }}>
                🏥 {p.businessName || "Unknown Pharmacy"}
              </p>
              {p.minutesAway && p.minutesAway !== Infinity && (
                <p style={{ color: "#4caf50", fontWeight: "500" }}>
                  {p.minutesAway <= 1
                    ? "📍 Right here"
                    : `💨 ~${p.minutesAway} mins away`}
                </p>
              )}
              <button
                onClick={() => addToCart(p)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
