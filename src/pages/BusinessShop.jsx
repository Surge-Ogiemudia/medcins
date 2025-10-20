// src/pages/BusinessShop.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { useParams } from "react-router-dom";

export default function BusinessShop() {
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
      <h2>🩺 {business?.businessName || "Pharmacy"} Shop</h2>
      <p>Browse medicines below. Login only required for purchase.</p>

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
