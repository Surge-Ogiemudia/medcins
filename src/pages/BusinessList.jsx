import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function BusinessList() {
  const [businesses, setBusinesses] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null)
    );
  }, []);

  // Fetch businesses
  useEffect(() => {
    async function fetchBusinesses() {
      const snap = await getDocs(collection(db, "users"));
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.role === "medicine-manager");
      setBusinesses(items);
    }
    fetchBusinesses();
  }, []);

  // Sort by proximity
  const sortedBusinesses = businesses
    .map((b) => {
      let distance = Infinity;
      if (
        userLocation &&
        b.location &&
        b.location.latitude &&
        b.location.longitude
      ) {
        distance = haversineKm(
          userLocation.lat,
          userLocation.lng,
          b.location.latitude,
          b.location.longitude
        );
      }
      return { ...b, distance };
    })
    .sort((a, b) => a.distance - b.distance);

  // Filter by search
  const filteredBusinesses = sortedBusinesses.filter((b) =>
    b.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: "30px" }}>
      <h2>Registered Medicine Retailers</h2>
      <p style={{ color: '#7c3aed', fontWeight: 'bold', marginBottom: '10px' }}>
        {businesses.length > 0 ? `${businesses.length} businesses found` : 'No businesses loaded yet.'}
      </p>
      <input
        type="text"
        placeholder="Search by business name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: "10px",
          width: "100%",
          maxWidth: "400px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          marginBottom: "20px",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "24px",
        }}
      >
        {filteredBusinesses.map((b) => (
          <div
            key={b.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "18px",
              background: "#fff",
              boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
              cursor: b.slug ? "pointer" : "not-allowed",
              opacity: b.slug ? 1 : 0.6,
              transition: "box-shadow 0.2s",
            }}
            onClick={() => b.slug && navigate(`/store/${b.slug}`)}
          >
            <h3 style={{ marginBottom: "8px", color: "#7c3aed" }}>{b.businessName || <span style={{color:'#e53935'}}>No name</span>}</h3>
            <p style={{ marginBottom: "6px", color: "#555" }}>
              {b.address || <span style={{color:'#888'}}>No address provided</span>}
            </p>
            {b.distance !== Infinity && (
              <p style={{ color: "#4caf50", fontWeight: "500" }}>
                {b.distance < 1
                  ? "📍 Very close"
                  : `~${b.distance.toFixed(1)} km away`}
              </p>
            )}
            <p style={{ fontSize: "0.9em", color: "#888" }}>
              Role: {b.role || <span style={{color:'#e53935'}}>No role</span>}
            </p>
            {!b.slug && (
              <p style={{ color: '#e53935', fontSize: '0.9em', marginTop: '8px' }}>
                No store link available
              </p>
            )}
          </div>
        ))}
      </div>
      {filteredBusinesses.length === 0 && (
        <p style={{ color: "gray", marginTop: "30px" }}>
          No businesses match your search.<br />
          {businesses.length === 0 && <span>Check if any businesses are registered in Firestore.</span>}
        </p>
      )}
    </div>
  );
}
