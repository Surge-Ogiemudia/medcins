// src/pages/AddMedicine.jsx
import { useState, useEffect } from "react";
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
  const [user, setUser] = useState(null); // Firebase Auth user
  const [userData, setUserData] = useState(null); // Firestore user doc (role, businessName, slug, etc.)
  const [medicines, setMedicines] = useState([]);
  const [medicine, setMedicine] = useState({
    name: "",
    ingredient: "",
    class: "",
    price: "",
    image: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [batches, setBatches] = useState([]);

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
    if (!user) return alert("Please log in first");
    if (!userData) return alert("Loading user data...");

    const { name, ingredient, class: medClass, price, image } = medicine;
    if (!name || !ingredient || !medClass || !price)
      return alert("Please fill all required fields");

    const parsedPrice = parseInt(price, 10);
    if (isNaN(parsedPrice) || parsedPrice < 0)
      return alert("Price must be a positive number");

    const { ownerSlug, businessName } = getOwnerMeta();

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
        });
      }
      setMedicine({ name: "", ingredient: "", class: "", price: "", image: "" });
    } catch (err) {
      console.error(err);
      alert("Error saving medicine");
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
    if (!csvPreview.length) return alert("No CSV data to upload");
    if (!user) return alert("Please log in first");
    if (!userData) return alert("Loading user data...");

    const batchRef = doc(collection(db, "batches"));
    const batchMedicineIds = [];
    const { ownerSlug, businessName } = getOwnerMeta();

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
    setCsvPreview([]);
  };

  const handleEdit = (med) => {
    setMedicine({
      name: med.name,
      ingredient: med.ingredient,
      class: med.class,
      price: med.price,
      image: med.image || "",
    });
    setEditingId(med.id);
  };

  const handleDelete = async (med) => {
    if (!window.confirm("Delete this medicine?")) return;
    try {
      await deleteDoc(doc(db, "products", med.id));
    } catch (err) {
      console.error(err);
      alert("Error deleting medicine");
    }
  };

  const handleDeleteBatch = async (batch) => {
    if (!window.confirm("Delete this batch and its medicines?")) return;
    try {
      for (let medId of batch.medicineIds) await deleteDoc(doc(db, "products", medId));
      await deleteDoc(doc(db, "batches", batch.id));
    } catch (err) {
      console.error(err);
      alert("Error deleting batch");
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
    <div style={{ padding: "30px" }}>
      <h2>{editingId ? "✏️ Edit Medicine" : "➕ Add New Medicine"}</h2>
      <p>Logged in as: {user.email}</p>

      {/* CSV Upload */}
      <h3>📄 Bulk Upload Medicines (CSV)</h3>
      <input type="file" accept=".csv" onChange={handleCsvChange} />
      {csvPreview.length > 0 && (
        <>
          <h4>Preview (Editable)</h4>
          <table border="1" cellPadding="5" style={{ width: "100%", marginBottom: "10px" }}>
            <thead>
              <tr>{requiredFields.map((f) => <th key={f}>{f}</th>)}</tr>
            </thead>
            <tbody>
              {csvPreview.map((row, i) => (
                <tr key={i}>
                  {requiredFields.map((field) => (
                    <td key={field}>
                      <input
                        type={field === "price" ? "number" : "text"}
                        value={row[field]}
                        style={{ width: "100%" }}
                        onChange={(e) => handleCsvFieldChange(i, field, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleCsvUpload}>Upload CSV</button>
        </>
      )}

      {/* Batches */}
      <h3>📂 Your Uploaded CSV Batches</h3>
      {batches.length === 0 ? (
        <p>No batches uploaded yet.</p>
      ) : (
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

      {/* Add/Edit Form */}
      <form onSubmit={handleAddMedicine} style={{ marginTop: "20px", marginBottom: "30px" }}>
        {requiredFields.map((field) => (
          <div key={field} style={{ marginBottom: "10px" }}>
            <label>
              {field === "name" ? "Medicine Name" :
                field === "ingredient" ? "Active Ingredient & Strength" :
                  field === "class" ? "Medicine Class" :
                    field === "price" ? "Price (₦)" : "Image URL (optional)"}
              <input
                type={field === "price" ? "number" : "text"}
                value={medicine[field]}
                onChange={(e) => setMedicine({ ...medicine, [field]: e.target.value })}
                style={{ marginLeft: "10px" }}
              />
            </label>
          </div>
        ))}
        <button type="submit">{editingId ? "Update Medicine" : "Add Medicine"}</button>
      </form>

      {/* Medicines List */}
      <h3>💊 Your Medicines</h3>
      {medicines.length === 0 ? <p>No medicines added yet.</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <th>Name</th>
              <th>Ingredient</th>
              <th>Class</th>
              <th>Price (₦)</th>
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
  );
}
