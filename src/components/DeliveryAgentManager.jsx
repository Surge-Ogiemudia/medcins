import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, getDocs } from "firebase/firestore";

export default function DeliveryAgentManager() {
  const [form, setForm] = useState({
    companyName: "",
    phoneNumber: "",
    whatsappNumber: "",
    rcNumber: "",
    businessAddress: "",
    email: "",
    coverageArea: "",
    operatingHours: "",
    logoUrl: "",
    slug: "",
    approved: false
  });
  const [agents, setAgents] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deliveryAgents"), snap => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function ensureApprovedField() {
      const q = query(collection(db, "deliveryAgents"));
      const snap = await getDocs(q);
      snap.forEach(async docSnap => {
        const data = docSnap.data();
        if (typeof data.approved === "undefined") {
          await doc(db, "deliveryAgents", docSnap.id).update({ approved: false });
        }
      });
    }
    ensureApprovedField();
  }, []);

  const handleChange = e => {
  setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleEditChange = e => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };
  const handleSubmit = async e => {
    e.preventDefault();
    // Generate slug from company name
    const slug = form.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    await addDoc(collection(db, "deliveryAgents"), { ...form, slug, approved: false });
    setForm({
      companyName: "",
      phoneNumber: "",
      whatsappNumber: "",
      rcNumber: "",
      businessAddress: "",
      email: "",
      coverageArea: "",
      operatingHours: "",
      logoUrl: "",
      slug: "",
      approved: false
    });
  };
  const handleEdit = agent => {
    setEditId(agent.id);
    setEditForm(agent);
  };
  const handleEditSave = async id => {
    await updateDoc(doc(db, "deliveryAgents", id), editForm);
    setEditId(null);
    setEditForm({});
  };
  const handleDelete = async id => {
    if (window.confirm("Delete this delivery agent?")) {
      await deleteDoc(doc(db, "deliveryAgents", id));
    }
  };

  // Approve delivery agent
  const handleApprove = async id => {
    setActionLoading(true);
    setActionMessage("");
    await updateDoc(doc(db, "deliveryAgents", id), { approved: true });
    setActionLoading(false);
    setActionMessage("Agent approved and now visible to public.");
  };
  // Take offline (reverse approve)
  const handleTakeOffline = async id => {
    setActionLoading(true);
    setActionMessage("");
    await updateDoc(doc(db, "deliveryAgents", id), { approved: false });
    setActionLoading(false);
    setActionMessage("Agent taken offline and hidden from public.");
  };
  return (
    <>
      {/* Add agent form removed for admin management. Admin can edit agents using the Edit button below. */}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '32px' }}>
        {actionLoading && <div style={{color:'#7c3aed', fontWeight:'bold', marginBottom:16}}>Processing...</div>}
        {actionMessage && <div style={{color:'#059669', fontWeight:'bold', marginBottom:16}}>{actionMessage}</div>}
        {agents.map(agent => (
          <div key={agent.id} style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', padding: '18px', minWidth: '260px', maxWidth: '320px', position: 'relative' }}>
            {editId === agent.id ? (
              <form onSubmit={e => { e.preventDefault(); handleEditSave(agent.id); }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input id="edit-companyName" type="text" name="companyName" placeholder="Company Name" value={editForm.companyName || ''} onChange={handleEditChange} required />
                <input id="edit-phoneNumber" type="text" name="phoneNumber" placeholder="Phone Number" value={editForm.phoneNumber || ''} onChange={handleEditChange} required />
                <input id="edit-whatsappNumber" type="text" name="whatsappNumber" placeholder="WhatsApp Phone Number" value={editForm.whatsappNumber || ''} onChange={handleEditChange} required />
                <input id="edit-rcNumber" type="text" name="rcNumber" placeholder="RC Number" value={editForm.rcNumber || ''} onChange={handleEditChange} required />
                <input id="edit-businessAddress" type="text" name="businessAddress" placeholder="Business Address" value={editForm.businessAddress || ''} onChange={handleEditChange} required />
                <input id="edit-email" type="email" name="email" placeholder="Email Address" value={editForm.email || ''} onChange={handleEditChange} required />
                <input id="edit-coverageArea" type="text" name="coverageArea" placeholder="Coverage Area" value={editForm.coverageArea || ''} onChange={handleEditChange} required />
                <input id="edit-operatingHours" type="text" name="operatingHours" placeholder="Operating Hours (e.g. 8am-6pm)" value={editForm.operatingHours || ''} onChange={handleEditChange} required />
                <input id="edit-logoUrl" type="url" name="logoUrl" placeholder="Business Logo URL (https://...)" value={editForm.logoUrl || ''} onChange={handleEditChange} required />
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button type="submit" style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold' }}>Save</button>
                  <button type="button" onClick={() => setEditId(null)} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: '6px', padding: '6px 14px' }}>Cancel</button>
                </div>
              </form>
            ) : (
              <React.Fragment>
                <img src={agent.logoUrl} alt={agent.companyName} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }} />
                <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: 4 }}>{agent.companyName}</div>
                <div style={{ color: '#7c3aed', fontWeight: 500, marginBottom: 4 }}>{agent.businessAddress}</div>
                <div>RC Number: {agent.rcNumber}</div>
                <div>Phone: {agent.phoneNumber}</div>
                <div>WhatsApp: {agent.whatsappNumber}</div>
                <div>Email: {agent.email}</div>
                <div>Coverage: {agent.coverageArea}</div>
                <div>Hours: {agent.operatingHours}</div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={() => handleEdit(agent)} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold' }}>Edit</button>
                  <button onClick={() => handleDelete(agent.id)} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold' }}>Delete</button>
                  {!agent.approved && (
                    <button onClick={() => handleApprove(agent.id)} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>Approve</button>
                  )}
                  {agent.approved && (
                    <button onClick={() => handleTakeOffline(agent.id)} style={{ background: '#f59e42', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>Take Offline</button>
                  )}
                </div>
                {agent.approved && <div style={{ color: '#059669', fontWeight: 'bold', marginTop: '8px' }}>✅ Approved</div>}
              </React.Fragment>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
