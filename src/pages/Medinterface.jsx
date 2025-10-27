
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

function MedicsList({ medics }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 24 }}>
      {[...medics].sort((a, b) => (b.online === true) - (a.online === true)).map((medic) => {
        let languagesArr = [];
        if (Array.isArray(medic.languages)) {
          languagesArr = medic.languages;
        } else if (typeof medic.languages === "string") {
          languagesArr = medic.languages.split(",").map(l => l.trim()).filter(Boolean);
        }
        return (
          <div
            key={medic.id}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 220,
              padding: 16,
              border: "1px solid #ccc",
              borderRadius: 12,
              background: "#f9f9f9",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              cursor: "pointer"
            }}
            onClick={() => window.open(`https://wa.me/${medic.whatsapp}`, "_blank")}
          >
            {/* Online/Offline Dot */}
            <span
              title={medic.online ? "Online" : "Offline"}
              style={{
                position: "absolute",
                top: 8,
                right: 12,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: medic.online ? "#27c93f" : "#bbb",
                border: "2px solid #fff",
                boxShadow: "0 0 2px #888"
              }}
            />
            <img src={medic.photo} alt={medic.name} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", marginBottom: 12 }} />
            <div style={{ fontWeight: "bold", fontSize: 18 }}>{medic.name}</div>
            <div>{medic.profession}</div>
            {medic.pharmacyName && (
              <div style={{ color: '#7c3aed', fontWeight: 500 }}>{medic.pharmacyName}</div>
            )}
            <div>License: {medic.license}</div>
            <div>Languages: {languagesArr.join(", ")}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Medinterface() {
  const [verifyMedics, setVerifyMedics] = useState([]);
  const [consultMedics, setConsultMedics] = useState([]);
  const [activeSection, setActiveSection] = useState("verify");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchMedics = async () => {
      // Get verifyMedics from collection
      const verifySnap = await getDocs(collection(db, "verifyMedics"));
      let verifyList = verifySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Get pharmacists from businesses
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.role === "medicine-manager" && data.pharmacist) {
          verifyList.push({
            ...data.pharmacist,
            id: d.id,
            online: true // or false, if you want to track online status
          });
        }
      });
      setVerifyMedics(verifyList);

      // Get consultMedics from collection
      const consultSnap = await getDocs(collection(db, "consultMedics"));
      setConsultMedics(consultSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchMedics();
  }, []);

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h2>🩺 Medical Interface</h2>
      <input
        type="text"
        placeholder="Search by name or pharmacy..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{
          padding: "10px",
          width: "100%",
          maxWidth: "400px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          marginBottom: "18px"
        }}
      />
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <button
          style={{
            padding: "10px 24px",
            borderRadius: 6,
            border: activeSection === "verify" ? "2px solid #1976d2" : "1px solid #ccc",
            background: activeSection === "verify" ? "#e3f2fd" : "#fff",
            fontWeight: "bold",
            cursor: "pointer"
          }}
          onClick={() => setActiveSection("verify")}
        >
          Verify Prescription
        </button>
        <button
          style={{
            padding: "10px 24px",
            borderRadius: 6,
            border: activeSection === "consult" ? "2px solid #1976d2" : "1px solid #ccc",
            background: activeSection === "consult" ? "#e3f2fd" : "#fff",
            fontWeight: "bold",
            cursor: "pointer"
          }}
          onClick={() => setActiveSection("consult")}
        >
          Get Consultation
        </button>
      </div>

      {activeSection === "verify" && (
        <>
          <h3>Verify Prescription Medics</h3>
          <MedicsList medics={verifyMedics.filter(medic => {
            const name = medic.name?.toLowerCase() || "";
            const pharmacy = medic.pharmacyName?.toLowerCase() || "";
            const term = searchTerm.toLowerCase();
            return name.includes(term) || pharmacy.includes(term);
          })} />
        </>
      )}
      {activeSection === "consult" && (
        <>
          <h3>Consultation Medics</h3>
          <MedicsList medics={consultMedics.filter(medic => {
            const name = medic.name?.toLowerCase() || "";
            const pharmacy = medic.pharmacyName?.toLowerCase() || "";
            const term = searchTerm.toLowerCase();
            return name.includes(term) || pharmacy.includes(term);
          })} />
        </>
      )}
    </div>
  );
}

// ...existing code...
