import React from "react";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useParams } from "react-router-dom";

export default function DeliveryAgent() {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    // Listen for all Processing orders with express delivery only
    const unsub = onSnapshot(collection(db, "orders"), snap => {
      setOrders(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(o => o.status === "Processing" && o.deliveryType === "express")
      );
    });
    return () => unsub();
  }, []);
  const [agents, setAgents] = useState([]);
  const { slug } = useParams();
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deliveryAgents"), snap => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Debug: log agents and slug
  React.useEffect(() => {
    console.log("Slug param:", slug);
    console.log("All agents:", agents);
    console.log("Approved agents:", agents.filter(agent => agent.approved === true));
    if (slug) {
      console.log("Filtered agent:", agents.filter(agent => agent.slug === slug && agent.approved === true));
    }
  }, [agents, slug]);

  // If slug param is present, filter to only that agent
  // Only show approved agents
  console.log("Slug param:", slug);
  console.log("All agents:", agents);
  const approvedAgents = agents.filter(agent => agent.approved === true);
  console.log("Approved agents:", approvedAgents);
  const visibleAgents = slug ? approvedAgents.filter(agent => agent.slug === slug) : approvedAgents;
  console.log("Visible agents:", visibleAgents);

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "auto" }}>
      <h2>🚚 {slug ? "Your Delivery Agent Profile" : "All Delivery Agents"}</h2>

      {/* Debug section removed. */}

      {/* Processing Orders Section */}
      <div style={{marginTop:40}}>
        <h3>📦 Processing Orders</h3>
        {orders.length === 0 ? <p>No processing orders found.</p> : (
          <div style={{display:'flex',flexWrap:'wrap',gap:24}}>
            {orders.map(order => {
              const deliveryInfo = order.deliveryInfo || {};
              const customerAddress = `${deliveryInfo.address || ''}, ${deliveryInfo.city || ''}, ${deliveryInfo.state || ''}`;
              const missingAddress = !deliveryInfo.address && !deliveryInfo.city && !deliveryInfo.state;
              return (
                <div key={order.id} style={{background:'#f9f9f9',border:'1px solid #ccc',borderRadius:10,padding:18,minWidth:260,maxWidth:340,marginBottom:18}}>
                  <div><strong>Order ID:</strong> {order.id}</div>
                  <div><strong>Date:</strong> {order.date ? new Date(order.date).toLocaleString() : 'N/A'}</div>
                  <div><strong>Customer Address:</strong> {missingAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span> : customerAddress}</div>
                  <pre style={{fontSize:12,background:'#f3f3f3',padding:6,borderRadius:4,margin:'4px 0 8px 0',color:'#333'}}>
                    deliveryInfo: {JSON.stringify(deliveryInfo)}
                  </pre>
                  {/* Add more order details as needed */}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', marginTop: '40px' }}>
        {visibleAgents.length === 0 ? <p>No delivery agents found.</p> : visibleAgents.map(agent => (
          <div key={agent.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', padding: '18px', minWidth: '260px', maxWidth: '320px', position: 'relative' }}>
            <img src={agent.logoUrl || "https://via.placeholder.com/80x80?text=Logo"} alt="Business Logo" style={{ width: 80, height: 80, borderRadius: '10px', objectFit: 'cover', marginBottom: 10 }} />
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>{agent.companyName}</div>
            <div>Phone: {agent.phoneNumber}</div>
            <div>WhatsApp: {agent.whatsappNumber}</div>
            <div>RC Number: {agent.rcNumber}</div>
            <div>Address: {agent.businessAddress}</div>
            <div>Email: {agent.email}</div>
            <div>Coverage: {agent.coverageArea}</div>
            <div>Hours: {agent.operatingHours}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
