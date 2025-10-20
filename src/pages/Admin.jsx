// src/pages/Admin.jsx
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { collection, doc, onSnapshot, deleteDoc, updateDoc, getDoc, query, where } from "firebase/firestore";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeSection, setActiveSection] = useState("products"); // products | users | orders
  const [expandedOrders, setExpandedOrders] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();

  // -------- Auth Listener & Fetch UserDoc --------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid));
        setUserData(snap.exists() ? snap.data() : { role: "customer" });
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return () => unsubscribeAuth();
  }, [auth]);

  // -------- Load Products & Batches --------
  useEffect(() => {
    const unsubscribeMeds = onSnapshot(collection(db, "products"), (snapshot) =>
      setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    const unsubscribeBatches = onSnapshot(collection(db, "batches"), (snapshot) => {
      setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => {
      unsubscribeMeds();
      unsubscribeBatches();
    };
  }, []);

  // -------- Load Users --------
  useEffect(() => {
    if (!userData) return;
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) =>
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    return () => unsubscribeUsers();
  }, [userData]);

  // -------- Load Orders --------
  useEffect(() => {
    const unsubscribeOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a,b) => new Date(b.date) - new Date(a.date));
      setOrders(list);
    });
    return () => unsubscribeOrders();
  }, []);

  const userMap = {};
  allUsers.forEach(u => (userMap[u.id] = u));

  // -------- Utility Functions --------
  const handleDeleteMedicine = async (med) => {
    if (!window.confirm(`Delete medicine: ${med.name}?`)) return;
    try { await deleteDoc(doc(db, "products", med.id)); } 
    catch(e){ console.error(e); alert("Error deleting medicine"); }
  };

  const handleDeleteBatch = async (batch) => {
    if (!window.confirm(`Delete batch: ${batch.name}?`)) return;
    try {
      for (let medId of batch.medicineIds) await deleteDoc(doc(db, "products", medId));
      await deleteDoc(doc(db, "batches", batch.id));
    } catch(e){ console.error(e); alert("Error deleting batch"); }
  };

  const handleRoleChange = async (userId, role) => {
    try { await updateDoc(doc(db,"users",userId), {role}); alert("Role updated!"); } 
    catch(e){ console.error(e); alert("Error updating role"); }
  };

  const toggleOrder = (orderId) => setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));

  const completeOrder = async (order) => {
    if (!window.confirm("Mark order as completed?")) return;
    await updateDoc(doc(db, "orders", order.id), { status: "Completed", completedBy: user.uid });
    alert("✅ Order marked completed");
  };

  const calculateTotal = (items) => items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  if (!user) return <p>Please log in to access admin.</p>;
  if (!userData) return <p>Loading user data...</p>;
  if (userData.role !== "admin") return <p>Access denied. Admins only.</p>;
  if (loading) return <p>Loading dashboard...</p>;

  // -------- Filtered Orders --------
  const pendingOrders = orders.filter(o => o.status === "processing");
  const completedOrders = orders.filter(o => o.status === "Completed" && o.completedBy === user.uid);

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif" }}>
      <h2>🛠 Admin Dashboard</h2>
      <p>Logged in as: {user.email}</p>

      {/* -------- Section Tabs -------- */}
      <div style={{ display: "flex", gap: "20px", margin: "20px 0" }}>
        <button onClick={()=>setActiveSection("products")} style={tabStyle(activeSection==="products")}>Manage Products</button>
        <button onClick={()=>setActiveSection("users")} style={tabStyle(activeSection==="users")}>Manage Users</button>
        <button onClick={()=>setActiveSection("orders")} style={tabStyle(activeSection==="orders")}>Manage Orders</button>
      </div>

      {/* -------- PRODUCTS SECTION -------- */}
      {activeSection==="products" && <>
        <h3>💊 Medicines</h3>
        {medicines.length===0 ? <p>No medicines yet.</p> :
        <table style={tableStyle}>
          <thead>
            <tr><th>Name</th><th>Ingredient</th><th>Class</th><th>Price (₦)</th><th>Uploaded By</th><th>Action</th></tr>
          </thead>
          <tbody>
            {medicines.map(med => <tr key={med.id} style={trStyle}><td>{med.name}</td><td>{med.ingredient}</td><td>{med.class}</td><td>{med.price}</td><td>{userMap[med.ownerId]?.businessName || med.ownerId}</td><td><button onClick={()=>handleDeleteMedicine(med)}>Delete</button></td></tr>)}
          </tbody>
        </table>}

        <h3 style={{marginTop:"30px"}}>📂 CSV Batches</h3>
        {batches.length===0 ? <p>No batches yet.</p> :
        <table style={tableStyle}>
          <thead>
            <tr><th>Batch Name</th><th>Date</th><th>Uploaded By</th><th>Medicines Count</th><th>Action</th></tr>
          </thead>
          <tbody>
            {batches.map(batch => <tr key={batch.id} style={trStyle}><td>{batch.name}</td><td>{new Date(batch.date).toLocaleString()}</td><td>{userMap[batch.uploadedBy]?.businessName || batch.uploadedBy}</td><td>{batch.medicineIds?.length || 0}</td><td><button onClick={()=>handleDeleteBatch(batch)}>Delete</button></td></tr>)}
          </tbody>
        </table>}
      </>}

      {/* -------- USERS SECTION -------- */}
      {activeSection==="users" && <>
        <h3>👥 All Users</h3>
        {allUsers.length===0 ? <p>No users found.</p> :
        <table style={tableStyle}>
          <thead>
            <tr><th>Email</th><th>Role</th><th>Change Role</th><th>Activity</th></tr>
          </thead>
          <tbody>
            {allUsers.map(u => <tr key={u.id} style={trStyle}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                <select value={u.role||"customer"} onChange={(e)=>handleRoleChange(u.id,e.target.value)}>
                  <option value="customer">Customer</option>
                  <option value="medicine-manager">Medicine Manager</option>
                  <option value="orders-only">Orders Only</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td><button onClick={()=>setSelectedUser(u)}>View Details</button></td>
            </tr>)}
          </tbody>
        </table>}

        {selectedUser && <UserDetail user={selectedUser} medicines={medicines.filter(m=>m.ownerId===selectedUser.id)} orders={orders.filter(o=>o.userId===selectedUser.id)} onClose={()=>setSelectedUser(null)}/>}
      </>}

      {/* -------- ORDERS SECTION -------- */}
      {activeSection==="orders" && <>
        <h3>📦 Pending / Processing Orders</h3>
        {pendingOrders.length===0 ? <p>No pending orders.</p> :
        pendingOrders.map(order=>(
          <div key={order.id} style={orderCardStyle}>
            <div style={{display:"flex", justifyContent:"space-between",alignItems:"center"}}>
              <p><strong>Order Date:</strong> {new Date(order.date).toLocaleString()}</p>
              <button onClick={()=>toggleOrder(order.id)}>{expandedOrders[order.id] ? "Hide Items" : "View Items"}</button>
            </div>
            {expandedOrders[order.id] && order.items?.length>0 &&
              <ul>{order.items.map((i,idx)=><li key={idx}>{i.name} - ₦{i.price} x {i.quantity||1}</li>)}</ul>}
            <p><strong>Total:</strong> ₦{calculateTotal(order.items||[])}</p>
            <button onClick={()=>completeOrder(order)}>Mark as Completed</button>
          </div>
        ))}

        <h3 style={{marginTop:"30px"}}>✅ Completed Orders (You)</h3>
        {completedOrders.length===0 ? <p>No completed orders yet.</p> :
        completedOrders.map(order=>(
          <div key={order.id} style={orderCardStyle}>
            <div style={{display:"flex", justifyContent:"space-between",alignItems:"center"}}>
              <p><strong>Order Date:</strong> {new Date(order.date).toLocaleString()}</p>
              <button onClick={()=>toggleOrder(order.id)}>{expandedOrders[order.id] ? "Hide Items" : "View Items"}</button>
            </div>
            {expandedOrders[order.id] && order.items?.length>0 &&
              <ul>{order.items.map((i,idx)=><li key={idx}>{i.name} - ₦{i.price} x {i.quantity||1}</li>)}</ul>}
            <p><strong>Total:</strong> ₦{calculateTotal(order.items||[])}</p>
          </div>
        ))}
      </>}
    </div>
  );
}

// -------- Tab Style --------
const tabStyle = (active) => ({
  padding:"10px 20px",
  border:"none",
  borderRadius:"5px",
  cursor:"pointer",
  background: active ? "#007bff" : "#eee",
  color: active ? "#fff" : "#000",
  fontWeight: active ? "bold":"normal"
});

// -------- Table Styles --------
const tableStyle = { width:"100%", borderCollapse:"collapse", marginBottom:"20px" };
const trStyle = { borderBottom:"1px solid #eee" };

// -------- Order Card Style --------
const orderCardStyle = { marginBottom:"20px", padding:"15px", border:"1px solid #ccc", borderRadius:"10px", background:"#f9f9f9" };

// -------- User Detail Modal Component --------
function UserDetail({user, medicines, orders, onClose}){
  return (
    <div style={{padding:"20px",border:"1px solid #ccc",borderRadius:"10px",marginTop:"20px",background:"#f0f0f0"}}>
      <h4>👤 {user.email} Details</h4>
      <button onClick={onClose} style={{marginBottom:"10px"}}>Close</button>
      <h5>📦 Products</h5>
      {medicines.length===0 ? <p>No products.</p> : <ul>{medicines.map(m=><li key={m.id}>{m.name} - ₦{m.price}</li>)}</ul>}
      <h5>🛒 Purchase History</h5>
      {orders.length===0 ? <p>No orders.</p> : <ul>{orders.map(o=><li key={o.id}>{o.items.map(i=>i.name).join(", ")} - ₦{o.items.reduce((sum,i)=>sum+(i.price*(i.quantity||1)),0)}</li>)}</ul>}
    </div>
  );
}
