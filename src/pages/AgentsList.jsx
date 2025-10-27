import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Link } from "react-router-dom";

export default function AgentsList() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      setLoading(true);
      const q = query(collection(db, "deliveryAgents"), where("approved", "==", true));
      const snap = await getDocs(q);
      setAgents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }
    fetchAgents();
  }, []);

  if (loading) return <div style={{padding:40}}>Loading...</div>;

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "auto" }}>
      <h2>🚚 All Approved Delivery Agents</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', marginTop: '40px' }}>
        {agents.length === 0 ? <p>No delivery agents found.</p> : agents.map(agent => (
          <Link to={`/agent/${agent.slug}`} key={agent.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', padding: '18px', minWidth: '260px', maxWidth: '320px', position: 'relative' }}>
              <img src={agent.logoUrl || "https://via.placeholder.com/80x80?text=Logo"} alt="Business Logo" style={{ width: 80, height: 80, borderRadius: '10px', objectFit: 'cover', marginBottom: 10 }} />
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>{agent.companyName}</div>
              <div>Phone: {agent.phoneNumber}</div>
              <div>Coverage: {agent.coverageArea}</div>
              <div>Hours: {agent.operatingHours}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
