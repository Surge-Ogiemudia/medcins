// src/pages/AddMedicine.jsx
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
  getDoc,
} from "firebase/firestore";
import Papa from "papaparse";

const requiredFields = ["name", "ingredient", "class", "price", "image"];

export default function AddMedicine() {
  const [medicineSearch, setMedicineSearch] = useState("");
  // ...existing code...
  const [activeTab, setActiveTab] = useState('add'); // 'add', 'manage', 'pharmacist'
  // Block if inside a store slug or if user is customer
  const path = window.location.pathname;
  const storeMatch = path.match(/^\/store\/([^\/]+)/);
  const [userRole, setUserRole] = useState(null);
  useEffect(() => {
    import("firebase/auth").then(({ getAuth, onAuthStateChanged }) => {
      const auth = getAuth();
      onAuthStateChanged(auth, async (u) => {
        if (u) {
          const { getDoc, doc } = await import("firebase/firestore");
          const snap = await getDoc(doc(db, "users", u.uid));
          setUserRole(snap.exists() ? snap.data().role : null);
        } else {
          setUserRole(null);
        }
      });
    });
  }, []);
  if (storeMatch || userRole === "customer") {
    return (
      <div style={{padding: '40px', textAlign: 'center', color: '#7c3aed'}}>
        <h2>Access Denied</h2>
        <p>This page is only for business/admin users. Please use the store features.</p>
      </div>
    );
  }
  // Block if inside a store slug
  // (Already handled above, so this block is removed)
  const [user, setUser] = useState(null); // Firebase Auth user
  const [userData, setUserData] = useState(null); // Firestore user doc (role, businessName, slug, etc.)
  const [medicines, setMedicines] = useState([]);
  const [medicine, setMedicine] = useState({
    name: "",
    ingredient: "",
    class: "",
    price: "",
    image: "",
    isPOM: false,
    registeredOnly: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [batches, setBatches] = useState([]);

  // Move filteredMedicines here, after medicines is defined
  const filteredMedicines = medicines.filter(med => {
    const q = medicineSearch.toLowerCase();
    return (
      med.name?.toLowerCase().includes(q) ||
      med.ingredient?.toLowerCase().includes(q) ||
      med.class?.toLowerCase().includes(q)
    );
  });

  const auth = getAuth();

  // 🔹 Track login and fetch Firestore user data
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) setUserData(userDoc.data());
          else setUserData({ role: "customer" });
        } catch (err) {
          console.error("Error fetching user doc:", err);
          setUserData({ role: "customer" });
        }
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return () => unsubscribeAuth();
  }, [auth]);

  // 🔹 Medicines listener (only user’s medicines)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const userMeds = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.ownerId === user.uid);
      setMedicines(userMeds);
    });
    return () => unsubscribe();
  }, [user]);

  // 🔹 Batches listener (only user’s batches)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "batches"), (snapshot) => {
      const userBatches = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.uploadedBy === user.uid);
      setBatches(userBatches);
    });
    return () => unsubscribe();
  }, [user]);

  // Helper to grab owner metadata (slug + businessName) safely
  const getOwnerMeta = () => {
    return {
      ownerSlug: userData?.slug || null,
      businessName: userData?.businessName || null,
    };
  };

  // 🔹 Add/update single medicine
  const handleAddMedicine = async (e) => {
    e.preventDefault();
    if (!user) return toast.error("Please log in first");
    if (!userData) return toast.info("Loading user data...");

    const { name, ingredient, class: medClass, price, image } = medicine;
    if (!name || !ingredient || !medClass || !price)
      return toast.warn("Please fill all required fields");

    const parsedPrice = parseInt(price, 10);
    if (isNaN(parsedPrice) || parsedPrice < 0)
      return toast.warn("Price must be a positive number");

  const { ownerSlug, businessName } = getOwnerMeta();
  // Get pharmacist info if available
  const pharmacist = userData?.pharmacist || null;

    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          name,
          ingredient,
          class: medClass,
          price: parsedPrice,
          image: image || "",
          ownerSlug: ownerSlug || "",
          businessName: businessName || "",
          isPOM: !!medicine.isPOM,
          registeredOnly: !!medicine.registeredOnly,
          pharmacist: pharmacist || null,
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "products"), {
          name,
          ingredient,
          class: medClass,
          price: parsedPrice,
          image: image || "",
          ownerId: user.uid,
          ownerSlug: ownerSlug || "",
          businessName: businessName || "",
          isPOM: !!medicine.isPOM,
          registeredOnly: !!medicine.registeredOnly,
          pharmacist: pharmacist || null,
        });
      }
      setMedicine({ name: "", ingredient: "", class: "", price: "", image: "", isPOM: false, registeredOnly: false });
    } catch (err) {
  console.error(err);
  toast.error("Error saving medicine");
    }
  };

  // 🔹 CSV handling
  const handleCsvChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const filteredData = results.data.map((row) => {
          const item = {};
          requiredFields.forEach((field) => (item[field] = row[field] || (field === "price" ? 0 : "N/A")));
          return item;
        });
        setCsvPreview(filteredData);
      },
    });
  };

  const handleCsvUpload = async () => {
  if (!csvPreview.length) return toast.info("No CSV data to upload");
  if (!user) return toast.error("Please log in first");
  if (!userData) return toast.info("Loading user data...");

    const batchRef = doc(collection(db, "batches"));
    const batchMedicineIds = [];
  const { ownerSlug, businessName } = getOwnerMeta();
  const pharmacist = userData?.pharmacist || null;

    for (let row of csvPreview) {
      try {
        const medRef = await addDoc(collection(db, "products"), {
          name: row.name,
          ingredient: row.ingredient,
          class: row.class,
          price: parseInt(row.price, 10) || 0,
          image: row.image === "N/A" ? "" : row.image,
          batchId: batchRef.id,
          ownerId: user.uid,
          ownerSlug: ownerSlug || "",
          businessName: businessName || "",
          isPOM: !!row.isPOM,
          pharmacist: pharmacist || null,
        });
        batchMedicineIds.push(medRef.id);
      } catch (err) {
        console.error("CSV upload error for row:", row, err);
      }
    }

    try {
      await setDoc(batchRef, {
        name: `CSV Upload - ${new Date().toLocaleString()}`,
        uploadedBy: user.uid,
        date: new Date().toISOString(),
        medicineIds: batchMedicineIds,
      });
    } catch (err) {
      console.error("Failed to create batch doc:", err);
    }

    alert(`✅ ${batchMedicineIds.length} medicines uploaded`);
  toast.success(`✅ ${batchMedicineIds.length} medicines uploaded`);
    setCsvPreview([]);
  };

  const handleEdit = (med) => {
    setMedicine({
      name: med.name,
      ingredient: med.ingredient,
      class: med.class,
      price: med.price,
      image: med.image || "",
      isPOM: !!med.isPOM,
    });
    setEditingId(med.id);
    setActiveTab('add'); // Switch to Add Medicines tab
  };

  const handleDelete = async (med) => {
    if (!window.confirm("Delete this medicine?")) return;
    try {
      await deleteDoc(doc(db, "products", med.id));
      toast.success("Medicine deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting medicine");
    }
  };

  const handleDeleteBatch = async (batch) => {
    if (!window.confirm("Delete this batch and its medicines?")) return;
    try {
      for (let medId of batch.medicineIds) await deleteDoc(doc(db, "products", medId));
      await deleteDoc(doc(db, "batches", batch.id));
      toast.success("Batch deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting batch");
    }
  };

  const handleCsvFieldChange = (index, field, value) => {
    const updated = [...csvPreview];
    updated[index][field] = value;
    setCsvPreview(updated);
  };

  // 🔹 Role check
  if (!user) return <p>Please log in to access this page.</p>;
  if (!userData) return <p>Loading user data...</p>;
  if (userData.role !== "medicine-manager" && userData.role !== "admin")
    return <p>Access denied. Medicine managers only.</p>;

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "auto" }}>
      <h2>Medicine Management</h2>
      <p>Logged in as: {user.email}</p>

      {/* Tabs */}
      <div style={{display:'flex',marginTop:30,gap:20}}>
        <button 
          style={{padding:'10px 30px',fontWeight:'bold',borderRadius:8,border:activeTab==='add'?'2px solid #1976d2':'1px solid #ccc',background:activeTab==='add'?'#e3f2fd':'#fff',cursor:'pointer'}} 
          onClick={()=>setActiveTab('add')}
        >Add Medicines</button>
        <button 
          style={{padding:'10px 30px',fontWeight:'bold',borderRadius:8,border:activeTab==='manage'?'2px solid #1976d2':'1px solid #ccc',background:activeTab==='manage'?'#e3f2fd':'#fff',cursor:'pointer'}} 
          onClick={()=>setActiveTab('manage')}
        >Manage Products</button>
        <button 
          style={{padding:'10px 30px',fontWeight:'bold',borderRadius:8,border:activeTab==='pharmacist'?'2px solid #1976d2':'1px solid #ccc',background:activeTab==='pharmacist'?'#e3f2fd':'#fff',cursor:'pointer'}} 
          onClick={()=>setActiveTab('pharmacist')}
        >Pharmacist Management</button>
      </div>

      {/* Tab Content */}
      <div style={{marginTop:30}}>
        {activeTab==='add' && (
          <div style={{background:'#f8f8ff',padding:'24px',borderRadius:'12px',maxWidth:'900px',margin:'auto'}}>
            <h3 style={{ color: "#7c3aed" }}>Add Medicines</h3>
            {/* Single Add/Edit Medicine Form */}
            <form onSubmit={handleAddMedicine} style={{ marginBottom: "20px" }}>
              <h4>{editingId ? "Edit Medicine" : "Add Medicine"}</h4>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input type="text" placeholder="Name" value={medicine.name} onChange={e => setMedicine({ ...medicine, name: e.target.value })} required style={{ flex: 1 }} />
                <input type="text" placeholder="Ingredient" value={medicine.ingredient} onChange={e => setMedicine({ ...medicine, ingredient: e.target.value })} required style={{ flex: 1 }} />
                <input type="text" placeholder="Class" value={medicine.class} onChange={e => setMedicine({ ...medicine, class: e.target.value })} required style={{ flex: 1 }} />
                <input type="number" placeholder="Price (₦)" value={medicine.price} onChange={e => setMedicine({ ...medicine, price: e.target.value })} required style={{ flex: 1 }} />
                <input type="text" placeholder="Image URL" value={medicine.image} onChange={e => setMedicine({ ...medicine, image: e.target.value })} style={{ flex: 1 }} />
              </div>
              <div style={{ marginTop: "10px" }}>
                <label style={{ marginRight: "20px" }}>
                  <input type="checkbox" checked={medicine.isPOM} onChange={e => setMedicine({ ...medicine, isPOM: e.target.checked })} /> Prescription Only (POM)
                </label>
              </div>
              <button type="submit" style={{ marginTop: "15px", background: "#7c3aed", color: "#fff", padding: "8px 16px", borderRadius: "6px" }}>
                {editingId ? "Update Medicine" : "Add Medicine"}
              </button>
              {editingId && (
                <button type="button" style={{ marginLeft: "10px" }} onClick={() => { setEditingId(null); setMedicine({ name: "", ingredient: "", class: "", price: "", image: "", isPOM: false, registeredOnly: false }); }}>
                  Cancel
                </button>
              )}
            </form>
            {/* CSV Upload Section */}
            <div>
              <h4>Bulk Add Medicines via CSV</h4>
              <input type="file" accept=".csv" onChange={handleCsvChange} style={{ marginBottom: "10px" }} />
              {csvPreview.length > 0 && (
                <div>
                  <h5>CSV Preview</h5>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
                    <thead>
                      <tr>
                        {requiredFields.map((field) => (<th key={field}>{field}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx}>
                          {requiredFields.map((field) => (<td key={field}>{row[field]}</td>))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={handleCsvUpload} style={{ background: "#7c3aed", color: "#fff", padding: "8px 16px", borderRadius: "6px" }}>Upload Medicines</button>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab==='manage' && (
          <div style={{background:'#f4f4fa',padding:'24px',borderRadius:'12px',maxWidth:'900px',margin:'auto'}}>
            <h3 style={{ color: "#7c3aed" }}>Manage Products</h3>
            {/* Uploaded CSV Batches Section FIRST */}
            <h4>Uploaded CSV Batches</h4>
            {batches.length === 0 ? (
              <p>No CSV batches uploaded yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Batch Name</th>
                    <th>Date</th>
                    <th>Medicines Count</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td>{batch.name}</td>
                      <td>{new Date(batch.date).toLocaleString()}</td>
                      <td>{batch.medicineIds?.length || 0}</td>
                      <td>
                        <button onClick={() => handleDeleteBatch(batch)} style={{ background: "#e53935", color: "#fff", padding: "6px 12px", borderRadius: "6px" }}>Delete Batch</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Medicines List */}
            <h4 style={{ marginTop: "32px" }}>Your Medicines</h4>
            <input
              type="text"
              placeholder="Search by name, ingredient, or class..."
              style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
              value={medicineSearch}
              onChange={e => setMedicineSearch(e.target.value)}
            />
            {filteredMedicines.length === 0 ? <p>No medicines found.</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                    <th>Name</th>
                    <th>Ingredient</th>
                    <th>Class</th>
                    <th>Price (₦)</th>
                    <th>POM</th>
                    <th>Image</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((med) => (
                    <tr key={med.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td>{med.name}</td>
                      <td>{med.ingredient}</td>
                      <td>{med.class}</td>
                      <td>{med.price}</td>
                      <td>{med.isPOM ? <span style={{ background: "#e53935", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>POM</span> : null}</td>
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
          </div>
        )}
        {activeTab==='pharmacist' && (
          <div style={{background:'#f8f8ff',padding:'24px',borderRadius:'12px',maxWidth:'900px',margin:'auto'}}>
            <h3 style={{ color: "#7c3aed" }}>Pharmacist Management</h3>
            {userData?.role === "medicine-manager" && (
              <PharmacistManager userId={user.uid} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// PharmacistManager component
import React from "react";

function PharmacistManager({ userId }) {
  const [pharmacist, setPharmacist] = React.useState(null);
  const [form, setForm] = React.useState({
    photo: "",
    name: "",
    profession: "Pharmacist",
    license: "",
    pharmacyName: "",
    languages: "",
    whatsapp: ""
  });
  const [editing, setEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const ref = doc(db, "users", userId);
    getDoc(ref).then(snap => {
      const data = snap.data();
      if (data && data.pharmacist) {
        setPharmacist(data.pharmacist);
        setForm({ ...data.pharmacist });
        setEditing(true);
      }
    });
  }, [userId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await updateDoc(doc(db, "users", userId), { pharmacist: { ...form } });
    setPharmacist({ ...form });
    setEditing(true);
    setLoading(false);
    alert("Pharmacist info saved!");
  };

  return (
    <div style={{ marginTop: 40, background: "#f7f7f7", padding: 24, borderRadius: 10 }}>
      <h3 style={{ color: "#7c3aed" }}>Manage Pharmacist</h3>
      <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
        <input name="photo" value={form.photo} onChange={handleChange} placeholder="Photo URL" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="name" value={form.name} onChange={handleChange} placeholder="Name" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="profession" value={form.profession} onChange={handleChange} placeholder="Profession" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="license" value={form.license} onChange={handleChange} placeholder="License Number" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="pharmacyName" value={form.pharmacyName} onChange={handleChange} placeholder="Pharmacy Name" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="languages" value={form.languages} onChange={handleChange} placeholder="Languages (comma separated)" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="WhatsApp Number (e.g. 2348012345678)" required style={{ width: "100%", marginBottom: 8 }} />
        <button type="submit" disabled={loading} style={{ marginTop: 10 }}>{editing ? "Update Pharmacist" : "Add Pharmacist"}</button>
      </form>
      {pharmacist && (
        <div style={{ marginTop: 16, background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 1px 4px #e0e0e0" }}>
          <img src={pharmacist.photo} alt={pharmacist.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", marginBottom: 8 }} />
          <div><b>{pharmacist.name}</b></div>
          <div>{pharmacist.profession}</div>
          <div>Pharmacy: {pharmacist.pharmacyName}</div>
          <div>License: {pharmacist.license}</div>
          <div>Languages: {pharmacist.languages}</div>
          <div><a href={`https://wa.me/${pharmacist.whatsapp}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></div>
        </div>
      )}
    </div>
  );
}
