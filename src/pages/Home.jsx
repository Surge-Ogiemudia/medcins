import { useEffect, useState } from "react";

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
    </div>
  );
}
