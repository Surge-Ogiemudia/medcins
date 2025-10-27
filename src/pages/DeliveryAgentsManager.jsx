import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function DeliveryAgentsManager() {
  const [form, setForm] = useState({
    companyName: "",
    phone: "",
    whatsapp: "",
    rcNumber: "",
    address: "",
    email: "",
    coverage: "",
    hours: "",
    logo: ""
  });
  const [agents, setAgents] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deliveryAgents"), snap => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "deliveryAgents", editId), form);
        setEditId(null);
      } else {
        await addDoc(collection(db, "deliveryAgents"), form);
      }
      setForm({
        companyName: "",
        phone: "",
        whatsapp: "",
        rcNumber: "",
        address: "",
        email: "",
        coverage: "",
        hours: "",
        logo: ""
      });
    } catch (err) {
      alert("Error saving agent");
    }
    setLoading(false);
  };

  const handleEdit = agent => {
    setForm(agent);
    setEditId(agent.id);
  };

  const handleDelete = async id => {
    if (window.confirm("Delete this delivery agent?")) {
      await deleteDoc(doc(db, "deliveryAgents", id));
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} style={{
        display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '420px', background: '#fafafa', padding: '24px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)'
      }}>
        <input type="text" name="companyName" placeholder="Company Name" value={form.companyName} onChange={handleChange} required />
        <input type="text" name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} required />
        <input type="text" name="whatsapp" placeholder="WhatsApp Phone Number" value={form.whatsapp} onChange={handleChange} required />
        <input type="text" name="rcNumber" placeholder="RC Number" value={form.rcNumber} onChange={handleChange} required />
        <input type="text" name="address" placeholder="Business Address" value={form.address} onChange={handleChange} required />
        <input type="email" name="email" placeholder="Email Address" value={form.email} onChange={handleChange} required />
        <input type="text" name="coverage" placeholder="Coverage Area" value={form.coverage} onChange={handleChange} required />
        <input type="text" name="hours" placeholder="Operating Hours (e.g. 8am-6pm)" value={form.hours} onChange={handleChange} required />
        <div>
          <label style={{ fontWeight: 500 }}>Business Logo Link:</label><br />
          <input type="url" name="logo" placeholder="Paste logo image URL here" value={form.logo} onChange={handleChange} style={{ marginTop: 6 }} required />
        </div>
        <button type="submit" disabled={loading} style={{ background: '#7c3aed', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '6px', padding: '10px 0', marginTop: '10px', cursor: 'pointer' }}>{editId ? "Update" : "Add"} Delivery Agent</button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', marginTop: '40px' }}>
        {agents.length === 0 ? <p>No delivery agents added yet.</p> : agents.map(agent => (
          <div key={agent.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', padding: '18px', minWidth: '260px', maxWidth: '320px', position: 'relative' }}>
            <img src={agent.logo || "https://via.placeholder.com/80x80?text=Logo"} alt="Business Logo" style={{ width: 80, height: 80, borderRadius: '10px', objectFit: 'cover', marginBottom: 10 }} />
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>{agent.companyName}</div>
            <div>Phone: {agent.phone}</div>
            <div>WhatsApp: {agent.whatsapp}</div>
            <div>RC Number: {agent.rcNumber}</div>
            <div>Address: {agent.address}</div>
            <div>Email: {agent.email}</div>
            <div>Coverage: {agent.coverage}</div>
            <div>Hours: {agent.hours}</div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button onClick={() => handleEdit(agent)} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>Edit</button>
              <button onClick={() => handleDelete(agent.id)} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
