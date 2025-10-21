// (removed duplicate misplaced code)
import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import Papa from "papaparse";

// Helper: Haversine formula for distance
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
  const drivingMultiplier = 1.64;
  const avgSpeedKmh = 25;
  const drivingKm = straightKm * drivingMultiplier;
  const minutes = Math.max(1, Math.round((drivingKm / avgSpeedKmh) * 60));
  return { drivingKm, minutes };
};

const ALLOWED_SHOP_STOCK = ["admin", "medicine-manager", "distributor"];
const ALLOWED_ADD_STOCK = ["admin", "distributor"];



export default function Restock() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState("shop");
  // Shop Stock state (must be inside component)
  const [products, setProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [addedMessage, setAddedMessage] = useState(null);

  // Get user location once
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation("denied")
    );
  }, []);

  // Fetch only distributor products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), async (snapshot) => {
      const items = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() };
          if (data.ownerId) {
            const businessRef = doc(db, "users", data.ownerId);
            const bizSnap = await getDoc(businessRef);
            if (bizSnap.exists()) {
              const bizData = bizSnap.data();
              data.businessName = bizData.businessName || "Unknown Distributor";
              data.ownerSlug = bizData.slug || null;
              data.ownerRole = bizData.role || null;
              if (bizData.location?.latitude && bizData.location?.longitude) {
                data.businessLat = bizData.location.latitude;
                data.businessLng = bizData.location.longitude;
              }
            }
          }
          return data;
        })
      );
      // Only show products where owner is a distributor
      setProducts(items.filter((p) => p.ownerRole === "distributor"));
    });
    return () => unsub();
  }, []);

  // Filter, group, sort
  useEffect(() => {
    if (products.length === 0) return;
    let filtered = products;
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = products.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(lower)) ||
          (p.ingredient && p.ingredient.toLowerCase().includes(lower)) ||
          (p.class && p.class.toLowerCase().includes(lower))
      );
    }
    // Proximity sort
    if (userLocation && userLocation !== "denied") {
      filtered = filtered.map((p) => {
        if (p.businessLat && p.businessLng) {
          const straightKm = haversineKm(
            userLocation.lat,
            userLocation.lng,
            p.businessLat,
            p.businessLng
          );
          const { minutes } = estimateDriving(straightKm);
          return { ...p, minutesAway: minutes };
        }
        return { ...p, minutesAway: Infinity };
      });
      filtered.sort((a, b) => a.minutesAway - b.minutesAway);
    }
    setDisplayProducts(filtered);
  }, [products, searchTerm, userLocation]);

  // Add to cart logic (mirrors Cart.jsx)
  const addToCart = async (item) => {
    if (!user) return alert("Please login first");
    try {
      const cartRef = doc(db, "carts", user.uid);
      const cartSnap = await getDoc(cartRef);
      let cart = [];
      if (cartSnap.exists()) cart = cartSnap.data().items || [];
      const index = cart.findIndex((i) => i.id === item.id);
      if (index >= 0) cart[index].quantity += 1;
      else cart.push({ ...item, quantity: 1 });
      await setDoc(cartRef, { items: cart });
      setAddedMessage(`Added ${item.name} to cart!`);
      setTimeout(() => setAddedMessage(null), 1500);
    } catch (err) {
      alert("Error adding to cart");
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
        return;
      }
      setUser(u);
  // Fetch user role from Firestore (modular syntax)
  const userDocRef = doc(db, "users", u.uid);
  const userDocSnap = await getDoc(userDocRef);
  setRole(userDocSnap.exists() ? userDocSnap.data().role : null);
    });
    return () => unsubscribe();
  }, []);

  if (!user) {
    return <div>Please log in to access this page.</div>;
  }

  if (!ALLOWED_SHOP_STOCK.includes(role) && !ALLOWED_ADD_STOCK.includes(role)) {
    return <div style={{ background: "#fff", minHeight: "100vh" }}></div>;
  }

  // Only show buttons if user has access
  const canSeeShop = ALLOWED_SHOP_STOCK.includes(role);
  const canSeeAdd = ALLOWED_ADD_STOCK.includes(role);

  // If user tries to access a tab they don't have permission for, show blank/restricted
  if ((activeTab === "shop" && !canSeeShop) || (activeTab === "add" && !canSeeAdd)) {
    return <div style={{ background: "#fff", minHeight: "100vh" }}></div>;
  }

  return (
    <div style={{ padding: "30px" }}>
      <h2>Restock</h2>
      <div style={{ marginBottom: "24px", display: "flex", gap: "16px" }}>
        {canSeeShop && (
          <button
            style={{
              padding: "10px 24px",
              borderRadius: "6px",
              border: activeTab === "shop" ? "2px solid #1976d2" : "1px solid #ccc",
              background: activeTab === "shop" ? "#e3f2fd" : "#fff",
              fontWeight: "bold",
              cursor: "pointer"
            }}
            onClick={() => setActiveTab("shop")}
          >
            Shop Stock
          </button>
        )}
        {canSeeAdd && (
          <button
            style={{
              padding: "10px 24px",
              borderRadius: "6px",
              border: activeTab === "add" ? "2px solid #1976d2" : "1px solid #ccc",
              background: activeTab === "add" ? "#e3f2fd" : "#fff",
              fontWeight: "bold",
              cursor: "pointer"
            }}
            onClick={() => setActiveTab("add")}
          >
            Add Stock
          </button>
        )}
      </div>

      {activeTab === "shop" && canSeeShop && (
        <section style={{ marginBottom: "40px" }}>
          <h3>Shop Stock</h3>
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
          {addedMessage && (
            <div style={{ color: "green", marginBottom: 10 }}>{addedMessage}</div>
          )}
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
                  {/* Registered Only Badge */}
                  {p.registeredOnly && p.registeredUniqueId && (
                    <span
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        background: "#7c3aed",
                        color: "#fff",
                        padding: "2px 10px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                        letterSpacing: "1px"
                      }}
                    >
                      Registered Only
                    </span>
                  )}
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
                  {Array.isArray(p.moqs) && p.moqs.length > 0 && (
                    <div style={{ margin: "8px 0" }}>
                      <strong>MOQ:</strong> {p.moqs.map((m, i) => (
                        <span key={i} style={{ marginRight: 8 }}>{m.type}</span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: "0.95em", color: "#555" }}>
                    Distributor: {p.businessName}
                  </p>
                  {p.minutesAway !== Infinity && (
                    <p style={{ color: "#4caf50", fontWeight: "500", fontSize: "0.9em" }}>
                      {p.minutesAway <= 1 ? "📍 Right here" : `💨 ~${p.minutesAway} mins away`}
                    </p>
                  )}
                  <button
                    style={{
                      marginTop: 10,
                      padding: "8px 16px",
                      borderRadius: "6px",
                      background: "#1976d2",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                    onClick={() => addToCart(p)}
                  >
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "add" && canSeeAdd && (
        <AddStockTab user={user} role={role} />
      )}
    </div>
  );
}


// AddStockTab: Add/edit stock, CSV upload, batch management
function AddStockTab({ user, role }) {

  // --- State ---
  const [form, setForm] = React.useState({ name: "", ingredient: "", class: "", price: "", image: "", moqs: [{ type: "sachet" }], registeredOnly: false });
  // Registered businesses state
  const [registeredBusinesses, setRegisteredBusinesses] = React.useState([]);
  const [showRegistered, setShowRegistered] = React.useState(false);
  React.useEffect(() => {
    if (role !== "distributor") return;
    // Listen for approved registrations for this distributor
    const unsub = onSnapshot(collection(db, "businessRegistrations"), (snap) => {
      setRegisteredBusinesses(snap.docs.filter(d => d.data().distributorId === user.uid && d.data().status === "approved").map(d => d.data()));
    });
    return () => unsub();
  }, [user, role]);
  // --- MOQ Handlers ---
  const handleMoqChange = (idx, e) => {
    const newMoqs = form.moqs.map((m, i) =>
      i === idx ? { type: e.target.value } : m
    );
    setForm({ ...form, moqs: newMoqs });
  };
  const addMoq = () => {
    setForm({ ...form, moqs: [...form.moqs, { type: "sachet" }] });
  };
  const removeMoq = (idx) => {
    setForm({ ...form, moqs: form.moqs.filter((_, i) => i !== idx) });
  };
  const [editingId, setEditingId] = React.useState(null);
  const [medicines, setMedicines] = React.useState([]);
  const [batches, setBatches] = React.useState([]);
  const [csvPreview, setCsvPreview] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(null);
  const [error, setError] = React.useState(null);

  // --- Fetch medicines and batches ---
  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "products"), (snapshot) => {
      let meds = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!isAdmin()) meds = meds.filter((m) => m.ownerId === user.uid);
      setMedicines(meds);
    });
    return () => unsub();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "batches"), (snapshot) => {
      let batchList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!isAdmin()) batchList = batchList.filter((b) => b.uploadedBy === user.uid);
      setBatches(batchList);
    });
    return () => unsub();
  }, [user]);

  // --- Helpers ---
  function isAdmin() {
    // You may want to pass role as prop, or fetch user role here
    // For now, check if user.email contains 'admin' (replace with your logic)
    return user?.email?.includes('admin');
  }

  // --- Add/Edit Medicine ---
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  // RegisteredOnly toggle handler
  const handleRegisteredOnlyButton = async () => {
    const newValue = !form.registeredOnly;
    setForm({ ...form, registeredOnly: newValue });
    if (role === "distributor" && user?.uid) {
      const productsRef = collection(db, "products");
      const snap = await getDocs(productsRef);
      const batch = [];
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.ownerId === user.uid) {
          const update = { registeredOnly: newValue };
          if (newValue) {
            update.registeredUniqueId = `${user.uid}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
          } else {
            update.registeredUniqueId = null;
          }
          batch.push(updateDoc(doc(db, "products", docSnap.id), update));
        }
      });
      await Promise.all(batch);
      window.location.reload();
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Always set ownerRole and ownerSlug for distributor uploads
      let ownerRole = role;
      let ownerSlug = null;
      let registeredUniqueId = null;
      if (role === "distributor") {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          ownerSlug = userDocSnap.data().slug || userDocSnap.data().businessSlug || null;
        }
        if (form.registeredOnly) {
          registeredUniqueId = `${user.uid}_${Date.now()}`;
        }
      }
      const payload = { ...form, ownerId: user.uid, ownerRole, ownerSlug };
      if (registeredUniqueId) payload.registeredUniqueId = registeredUniqueId;
      if (editingId) {
        await setDoc(doc(db, "products", editingId), payload, { merge: true });
        setEditingId(null);
        setSuccess("Medicine updated!");
      } else {
        await addDoc(collection(db, "products"), payload);
        setSuccess("Medicine added!");
      }
      setForm({ name: "", ingredient: "", class: "", price: "", image: "", moqs: [{ type: "sachet", value: "", price: "" }], registeredOnly: false });
    } catch (err) {
      setError("Error saving medicine");
    }
    setLoading(false);
  };

  // --- Edit/Delete Medicine ---
  const handleEdit = (med) => {
    setForm({
      name: med.name,
      ingredient: med.ingredient,
      class: med.class,
      price: med.price,
      image: med.image || "",
      moqs: med.moqs || [{ type: "sachet", value: "", price: "" }],
    });
    setEditingId(med.id);
  };
  const handleDelete = async (med) => {
    if (!window.confirm("Delete this medicine?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "products", med.id));
      setSuccess("Medicine deleted");
    } catch (err) {
      setError("Error deleting medicine");
    }
    setLoading(false);
  };

  // --- CSV Upload ---
  const handleCsvChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvPreview(results.data);
      },
      error: () => setError("Failed to parse CSV"),
    });
  };
  const handleCsvUpload = async () => {
    console.log('handleCsvUpload called. user:', user, 'role:', role);
    if (!csvPreview.length) return;
    if (!user || !role) {
      setError("User or role not loaded. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const batchRef = doc(collection(db, "batches"));
    const batchMedicineIds = [];
    let ownerRole = role;
    let ownerSlug = null;
    if (role === "distributor") {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        ownerSlug = userDocSnap.data().slug || userDocSnap.data().businessSlug || null;
      }
    }
    for (let row of csvPreview) {
      try {
        let moqs = [];
        if (row.moqs) {
          try { moqs = JSON.parse(row.moqs); } catch {}
        }
        let registeredUniqueId = null;
        if (role === "distributor" && row.registeredOnly === true) {
          registeredUniqueId = `${user.uid}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
        }
        const medRef = await addDoc(collection(db, "products"), {
          name: row.name,
          ingredient: row.ingredient,
          class: row.class,
          price: parseInt(row.price, 10) || 0,
          image: row.image || "",
          batchId: batchRef.id,
          ownerId: user.uid,
          ownerRole,
          ownerSlug,
          moqs,
          registeredOnly: !!row.registeredOnly,
          ...(registeredUniqueId ? { registeredUniqueId } : {}),
        });
        batchMedicineIds.push(medRef.id);
      } catch (err) {
        // skip error
      }
    }
    await setDoc(batchRef, {
      name: `CSV Upload - ${new Date().toLocaleString()}`,
      uploadedBy: user.uid,
      date: new Date().toISOString(),
      medicineIds: batchMedicineIds,
    });
    setSuccess(`${batchMedicineIds.length} medicines uploaded`);
    setCsvPreview([]);
    setLoading(false);
  };

  // --- Delete Batch ---
  const handleDeleteBatch = async (batch) => {
    if (!window.confirm("Delete this batch and its medicines?")) return;
    setLoading(true);
    try {
      for (let medId of batch.medicineIds) await deleteDoc(doc(db, "products", medId));
      await deleteDoc(doc(db, "batches", batch.id));
      setSuccess("Batch deleted");
    } catch (err) {
      setError("Error deleting batch");
    }
    setLoading(false);
  };

  // --- UI ---
  return (
    <section style={{ maxWidth: 900, margin: "0 auto", background: "#fff", padding: 24, borderRadius: 10 }}>
      {role === "distributor" && (
        <section style={{ marginBottom: 32, border: "1px solid #e0e0e0", borderRadius: 10, background: "#f8f6ff", padding: 18 }}>
          <button
            type="button"
            onClick={() => setShowRegistered((v) => !v)}
            style={{
              background: showRegistered ? "#7c3aed" : "#ede9fe",
              color: showRegistered ? "#fff" : "#7c3aed",
              border: "none",
              borderRadius: 6,
              padding: "10px 18px",
              fontWeight: "bold",
              marginBottom: 10,
              cursor: "pointer"
            }}
          >
            {showRegistered ? "Hide Registered Businesses" : "Show Registered Businesses"}
          </button>
          {showRegistered && (
            <div>
              <h3 style={{ color: "#7c3aed", marginBottom: 10 }}>Registered Businesses</h3>
              <p style={{ fontSize: 15, color: "#555", marginBottom: 16 }}>
                These are businesses that have registered and been approved to buy from you. You can use this list to manage your relationships and track registrations.
              </p>
              {registeredBusinesses.length === 0 ? (
                <p style={{ color: "#888" }}>No businesses registered yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8 }}>
                  <thead>
                    <tr style={{ background: "#ede9fe" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Business Name</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Email</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredBusinesses.map((b, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px 12px" }}><b>{b.businessInfo?.businessName || b.businessId}</b></td>
                        <td style={{ padding: "8px 12px" }}>{b.businessInfo?.email || ""}</td>
                        <td style={{ padding: "8px 12px" }}>{b.businessInfo?.phone || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}
      <h3>Add Stock</h3>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <input name="name" value={form.name} onChange={handleChange} placeholder="Medicine Name" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="ingredient" value={form.ingredient} onChange={handleChange} placeholder="Ingredient" style={{ width: "100%", marginBottom: 8 }} />
        <input name="class" value={form.class} onChange={handleChange} placeholder="Class" style={{ width: "100%", marginBottom: 8 }} />
        <input name="price" value={form.price} onChange={handleChange} placeholder="Default Price" type="number" min="0" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="image" value={form.image} onChange={handleChange} placeholder="Image URL" style={{ width: "100%", marginBottom: 8 }} />
        {role === "distributor" && (
          <div style={{ marginBottom: "10px" }}>
            <button
              type="button"
              onClick={handleRegisteredOnlyButton}
              style={{
                background: form.registeredOnly ? "#7c3aed" : "#ede9fe",
                color: form.registeredOnly ? "#fff" : "#7c3aed",
                border: "none",
                borderRadius: 6,
                padding: "10px 18px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {form.registeredOnly ? "Disable 'Only registered businesses can buy'" : "Enable 'Only registered businesses can buy'"}
            </button>
          </div>
        )}
        <div style={{ margin: "16px 0" }}>
          <strong>MOQ:</strong>
          {form.moqs.map((m, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <select value={m.type} onChange={e => handleMoqChange(idx, e)} style={{ width: 120 }}>
                <option value="sachet">Sachet</option>
                <option value="pack">Pack</option>
                <option value="carton">Carton</option>
              </select>
              {form.moqs.length > 1 && <button type="button" onClick={() => removeMoq(idx)} style={{ color: "red" }}>✕</button>}
            </div>
          ))}
          <button type="button" onClick={addMoq} style={{ marginTop: 4 }}>+ Add MOQ</button>
        </div>
        <button type="submit" disabled={loading} style={{ marginTop: 10 }}>{editingId ? "Update Medicine" : "Add Medicine"}</button>
      </form>

      {/* CSV Upload */}
      <h4>Bulk Add via CSV</h4>
      <input type="file" accept=".csv" onChange={handleCsvChange} />
      {csvPreview.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={handleCsvUpload} disabled={loading}>Submit CSV ({csvPreview.length} rows)</button>
        </div>
      )}

      {/* My Medicines List */}
      <h4 style={{ marginTop: 32 }}>My Medicines {isAdmin() && "(All Users)"}</h4>
      {medicines.length === 0 ? <p>No medicines added yet.</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <th>Name</th>
              <th>Ingredient</th>
              <th>Class</th>
              <th>Price</th>
              <th>MOQ</th>
              <th>Image</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((med) => (
              <tr key={med.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{med.name}</td>
                <td>{med.ingredient}</td>
                <td>{med.class}</td>
                <td>{med.price}</td>
                <td>
                  {Array.isArray(med.moqs) && med.moqs.length > 0 ? (
                    med.moqs.map((m, i) => (
                      <span key={i} style={{ marginRight: 8 }}>{m.type}</span>
                    ))
                  ) : "-"}
                </td>
                <td>{med.image && <img src={med.image} alt={med.name} style={{ width: "50px", height: "50px", objectFit: "cover" }} />}</td>
                <td>
                  <button onClick={() => handleEdit(med)} style={{ marginRight: "5px" }}>Edit</button>
                  <button onClick={() => handleDelete(med)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* My CSV Batches List */}
      <h4 style={{ marginTop: 32 }}>My CSV Batches {isAdmin() && "(All Users)"}</h4>
      {batches.length === 0 ? <p>No batches uploaded yet.</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <th>Batch Name</th>
              <th>Date</th>
              <th>Medicines Count</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{batch.name}</td>
                <td>{new Date(batch.date).toLocaleString()}</td>
                <td>{batch.medicineIds.length}</td>
                <td><button onClick={() => handleDeleteBatch(batch)}>Delete Batch</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {success && <div style={{ color: "green", marginTop: 10 }}>{success}</div>}
      {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
    </section>
  );
}

