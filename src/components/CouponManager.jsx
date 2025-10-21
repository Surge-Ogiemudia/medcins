import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, doc } from "firebase/firestore";

export default function CouponManager() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState({ code: "", percent: 0, removePOM: false, removeDelivery: false });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "coupons"), (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code) return alert("Coupon code required");
    if (editingId) {
      await updateDoc(doc(db, "coupons", editingId), form);
      setEditingId(null);
    } else {
      await addDoc(collection(db, "coupons"), form);
    }
    setForm({ code: "", percent: 0, removePOM: false, removeDelivery: false });
  };

  const handleEdit = (c) => {
    setForm({ code: c.code, percent: c.percent, removePOM: !!c.removePOM, removeDelivery: !!c.removeDelivery });
    setEditingId(c.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete coupon?")) return;
    await deleteDoc(doc(db, "coupons", id));
  };

  return (
    <div style={{ marginTop: 30 }}>
      <h3>🎟 Manage Coupons</h3>
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input placeholder="Code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={{ marginRight: 10 }} />
        <input type="number" placeholder="% Off" value={form.percent} min={0} max={100} onChange={e => setForm({ ...form, percent: parseInt(e.target.value) })} style={{ width: 80, marginRight: 10 }} />
        <label style={{ marginRight: 10 }}>
          <input type="checkbox" checked={form.removePOM} onChange={e => setForm({ ...form, removePOM: e.target.checked })} /> Remove POM Fee
        </label>
        <label style={{ marginRight: 10 }}>
          <input type="checkbox" checked={form.removeDelivery} onChange={e => setForm({ ...form, removeDelivery: e.target.checked })} /> Remove Delivery Fee
        </label>
        <button type="submit">{editingId ? "Update" : "Create"}</button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ code: "", percent: 0, removePOM: false, removeDelivery: false }); }}>Cancel</button>}
      </form>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr><th>Code</th><th>% Off</th><th>POM Fee</th><th>Delivery Fee</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {coupons.map(c => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>{c.percent}%</td>
              <td>{c.removePOM ? "Removed" : "-"}</td>
              <td>{c.removeDelivery ? "Removed" : "-"}</td>
              <td>
                <button onClick={() => handleEdit(c)} style={{ marginRight: 5 }}>Edit</button>
                <button onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
