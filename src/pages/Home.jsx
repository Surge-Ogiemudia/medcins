
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(coords);
          localStorage.setItem("customerLocation", JSON.stringify(coords));
          console.log("✅ Location saved:", coords);
        },
        (err) => {
          console.error("❌ Location access denied:", err.message);
          setError("Location access denied. Please enable location services.");
        }
      );
    } else {
      setError("Geolocation not supported by this browser.");
    }
  }, []);

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h2>🏠 Welcome to Medcins</h2>
      <p>Your trusted online pharmacy.</p>

      {location ? (
        <p>
          📍 Your location: <b>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</b>
        </p>
      ) : (
        <p style={{ color: "gray" }}>{error || "Detecting your location..."}</p>
      )}

      {/* Banner Button to Find Pharmacies */}
      <div style={{ margin: "40px 0" }}>
        <Link
          to="/store"
          style={{
            display: "inline-block",
            padding: "18px 36px",
            background: "linear-gradient(90deg,#7c3aed,#4f46e5)",
            color: "#fff",
            fontSize: "1.3em",
            fontWeight: "bold",
            borderRadius: "12px",
            boxShadow: "0 2px 12px rgba(124,58,237,0.12)",
            textDecoration: "none",
            transition: "background 0.2s,box-shadow 0.2s",
          }}
        >
          🔎 Find a pharmacy store near you
        </Link>
      </div>
    </div>
  );
}
