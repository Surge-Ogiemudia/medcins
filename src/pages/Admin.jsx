// src/pages/Admin.jsx
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { collection, doc, onSnapshot, deleteDoc, updateDoc, getDoc, query, where, getDocs, addDoc } from "firebase/firestore";
import CouponManager from "../components/CouponManager";
import DeliveryAgentManager from "../components/DeliveryAgentManager";

export default function AdminDashboard() {
  // List of all delivery agents for reassign dropdown (from deliveryAgents collection)
  const [allAgents, setAllAgents] = useState([]);
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const snap = await getDocs(collection(db, 'deliveryAgents'));
        setAllAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setAllAgents([]);
      }
    };
    fetchAgents();
  }, []);
  // State to track which order's reassign dropdown is open
  const [reassignDropdown, setReassignDropdown] = useState({});

  // Handler to reassign order to a new rider
  const handleReassignOrder = async (orderId, riderId) => {
    try {
      // Find the agent object for name and userId
      const agent = allAgents.find(a => a.id === riderId);
      const agentUserId = agent?.userId || '';
      await updateDoc(doc(db, 'orders', orderId), {
        riderId: agentUserId,
        assignedAgentId: agentUserId,
        assignedAgentName: agent ? (agent.companyName || agent.name || agent.email || agent.id) : '',
        status: 'In-Progress',
        assignedAt: new Date().toISOString(),
      });
      setReassignDropdown(prev => ({ ...prev, [orderId]: false }));
      toast.success('Order reassigned successfully.');
    } catch (err) {
      toast.error('Failed to reassign order.');
    }
  };
  // Cancel order handler for admin
  const handleCancelOrder = async (order) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelled',
        cancelledBy: 'admin',
        cancelledAt: new Date().toISOString(),
      });
      toast.success('Order cancelled.');
    } catch (err) {
      toast.error('Failed to cancel order.');
    }
  };
  // Collapsible state for orders sections (pending, completed, cancelled)
  const [openOrdersSection, setOpenOrdersSection] = useState({ pending: true, completed: true, cancelled: true });
  // Medicine filter states (must be inside component)
  const [medNameFilter, setMedNameFilter] = useState("");
  const [medIngredientFilter, setMedIngredientFilter] = useState("");
  const [medClassFilter, setMedClassFilter] = useState("");
  const [medPharmacyFilter, setMedPharmacyFilter] = useState("");
  // Per-order showAllItems state for pending orders
  const [showAllItems, setShowAllItems] = useState({});
  // Per-order showAllItems state for completed orders
  const [showAllItemsCompleted, setShowAllItemsCompleted] = useState({});
  // Block if inside a store slug or if user is customer
  const path = window.location.pathname;
  const storeMatch = path.match(/^\/store\/([^\/]+)/);
  const [userRole, setUserRole] = React.useState(null);
  useEffect(() => {
    import("firebase/auth").then(({ getAuth, onAuthStateChanged }) => {
      const auth = getAuth();
      onAuthStateChanged(auth, async (u) => {
        if (u) {
          // Use dynamic import for firebase/firestore, but use ESM import for db
          const { getDoc, doc } = await import("firebase/firestore");
          const { db } = await import("../firebase");
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
  // Distributor registration requests
  const [registrationRequests, setRegistrationRequests] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "businessRegistrations"), (snap) => {
      setRegistrationRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Approve/decline registration
  const handleRegistrationDecision = async (req, status) => {
    await updateDoc(doc(db, "businessRegistrations", req.id), { status });
    if (status === "declined") {
      // Optionally, cancel related orders
      const q = query(collection(db, "orders"), where("userId", "==", req.businessId), where("items", "array-contains-any", req.cart));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        await updateDoc(doc(db, "orders", docSnap.id), { status: "Canceled", canceledReason: "Distributor declined registration" });
      }
    }
    toast.info(`Registration ${status}`);
  };
  // Download/filter state

  // Download handler
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [medicFilter, setMedicFilter] = useState("");
    const [productFilter, setProductFilter] = useState("");
    const [pomFilter, setPomFilter] = useState("");
  
    const handleDownloadOrders = () => {
      let filtered = completedOrders;
      if (dateFrom) filtered = filtered.filter(o => new Date(o.completedAt || o.date) >= new Date(dateFrom));
      if (dateTo) filtered = filtered.filter(o => new Date(o.completedAt || o.date) <= new Date(dateTo));
      if (medicFilter) filtered = filtered.filter(o => o.medicVerifiedBy === medicFilter);
      if (productFilter) filtered = filtered.filter(o => o.items && o.items.some(i => i.name && i.name.toLowerCase().includes(productFilter.toLowerCase())));
      if (pomFilter === "true") filtered = filtered.filter(o => o.items && o.items.some(i => i.isPOM));
      if (pomFilter === "false") filtered = filtered.filter(o => o.items && !o.items.some(i => i.isPOM));
  
      // CSV header
      const header = [
        "Order ID","Date","User Email","Medic Verified By","Amount","Products","POM Items"
      ];
      // CSV rows
      const rows = filtered.map(o => [
        o.id,
        new Date(o.completedAt || o.date).toLocaleString(),
        (userMap[o.userId] && userMap[o.userId].email) ? userMap[o.userId].email : o.userId,
        o.medicVerifiedBy ? ((verifyMedics.concat(consultMedics).find(m => m.id === o.medicVerifiedBy) || {}).name || o.medicVerifiedBy) : "",
        o.total || calculateTotal(o.items || []),
        (o.items ? o.items.map(i => `${i.name} (${i.quantity || 1})`).join("; ") : ""),
        (o.items ? o.items.filter(i => i.isPOM).map(i => i.name).join("; ") : "")
      ]);
      // CSV string
      const csv = [header, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(",")).join("\r\n");
      // Download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

  const [selectedMedic, setSelectedMedic] = useState("");
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchSearch, setBatchSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeSection, setActiveSection] = useState("products"); // products | users | orders | medics
  const [expandedOrders, setExpandedOrders] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyMedics, setVerifyMedics] = useState([]);
  const [consultMedics, setConsultMedics] = useState([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSort, setOrderSort] = useState("date-desc");

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
  try { await deleteDoc(doc(db, "products", med.id)); toast.success("Medicine deleted."); } 
  catch(e){ console.error(e); toast.error("Error deleting medicine"); }
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

  useEffect(() => {
    getDocs(collection(db, "verifyMedics")).then(snap => {
      setVerifyMedics(snap.docs.map(d => ({ id: d.id, ...d.data(), type: "Prescription Verification" })));
    });
    getDocs(collection(db, "consultMedics")).then(snap => {
      setConsultMedics(snap.docs.map(d => ({ id: d.id, ...d.data(), type: "Consultation" })));
    });
  }, []);

  const completeOrder = async (order) => {
    // Check if order contains any POM item
    const hasPOM = order.items?.some(i => i.isPOM);
    let medicId = null;
    if (hasPOM) {
      if (!selectedMedic) return alert("Select a verifying medic before completing POM order.");
      medicId = selectedMedic;
    }
    if (!window.confirm("Mark order as completed?")) return;
    await updateDoc(doc(db, "orders", order.id), {
      status: "Completed",
      completedBy: user.uid,
      completedAt: new Date().toISOString(),
      medicVerifiedBy: medicId || null
    });
    alert("✅ Order marked completed");
    setSelectedMedic("");
  };

  const calculateTotal = (items) => items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  if (!user) return <p>Please log in to access admin.</p>;
  if (!userData) return <p>Loading user data...</p>;
  if (userData.role !== "admin") return <p>Access denied. Admins only.</p>;
  if (loading) return <p>Loading dashboard...</p>;

  // -------- Filtered Orders --------
  // Show both Processing and In-Progress orders as pending
  // Add search and sorting to pending orders
  const filteredPendingOrders = orders
    .filter(o => o.status === "Processing" || o.status === "In-Progress")
    .filter(order => {
      if (!orderSearch) return true;
      const term = orderSearch.toLowerCase();
      return (
        (userMap[order.userId]?.email || order.userId).toLowerCase().includes(term) ||
        order.items?.some(i => i.name.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      if (orderSort === "date-desc") return new Date(b.date) - new Date(a.date);
      if (orderSort === "date-asc") return new Date(a.date) - new Date(b.date);
      if (orderSort === "amount-desc") return (b.total || 0) - (a.total || 0);
      if (orderSort === "amount-asc") return (a.total || 0) - (b.total || 0);
      return 0;
    });
  const completedOrders = orders.filter(o => o.status === "Completed");
  const filteredCompletedOrders = completedOrders
    .filter(order => {
      if (!orderSearch) return true;
      const term = orderSearch.toLowerCase();
      return (
        (userMap[order.userId]?.email || order.userId).toLowerCase().includes(term) ||
        order.items?.some(i => i.name.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      if (orderSort === "date-desc") return new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date);
      if (orderSort === "date-asc") return new Date(a.completedAt || a.date) - new Date(b.completedAt || b.date);
      if (orderSort === "amount-desc") return (b.total || 0) - (a.total || 0);
      if (orderSort === "amount-asc") return (a.total || 0) - (b.total || 0);
      return 0;
    });

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif" }}>
      {/* Distributor Registration Requests */}
      {registrationRequests.length > 0 && (
        <div style={{ background: "#f3f0ff", padding: 24, borderRadius: 10, marginBottom: 30 }}>
          <h3 style={{ color: "#7c3aed" }}>Distributor Registration Requests</h3>
          {registrationRequests.map((req, idx) => (
            <div key={req.id} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px #e0e0e0" }}>
              <h4 style={{ color: "#7c3aed" }}>Business: {req.businessInfo?.businessName || req.businessId}</h4>
              <p>Email: {req.businessInfo?.email || ""}</p>
              <p>Phone: {req.businessInfo?.phone || ""}</p>
              <p>Address: {req.businessInfo?.address || ""}</p>
              <p>Products: {req.cart?.map(item => item.name).join(", ")}</p>
              <p>Status: <b>{req.status}</b></p>
              {req.status === "pending" && (
                <>
                  <button onClick={() => handleRegistrationDecision(req, "approved")} style={{ background: "#27c93f", color: "#fff", padding: "8px 18px", borderRadius: 6, fontWeight: "bold", marginRight: 10 }}>Approve</button>
                  <button onClick={() => handleRegistrationDecision(req, "declined")} style={{ background: "#e53935", color: "#fff", padding: "8px 18px", borderRadius: 6, fontWeight: "bold" }}>Decline</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

    {/* -------- Section Tabs -------- */}
    <div style={{ display: "flex", gap: "20px", margin: "20px 0", justifyContent: "center" }}>
      <button onClick={()=>setActiveSection("products")} style={tabStyle(activeSection==="products")}>Manage Products</button>
      <button onClick={()=>setActiveSection("users")} style={tabStyle(activeSection==="users")}>Manage Users</button>
      <button onClick={()=>setActiveSection("orders")} style={tabStyle(activeSection==="orders")}>Manage Orders</button>
      <button onClick={()=>setActiveSection("medics")} style={tabStyle(activeSection==="medics")}>Manage Medics</button>
      <button onClick={()=>setActiveSection("deliveryagents")} style={tabStyle(activeSection==="deliveryagents")}>Manage DeliveryAgents</button>
      <button onClick={()=>setActiveSection("coupons")} style={tabStyle(activeSection==="coupons")}>Manage Coupons</button>
    </div>

    <div style={{ padding: "0 30px" }}>
      <h2>🛠 Admin Dashboard</h2>
      <p>Logged in as: {user.email}</p>

      {/* -------- DELIVERY AGENTS SECTION -------- */}
      {activeSection==="deliveryagents" && <>
        <h3>🚚 Manage Delivery Agents</h3>
        <div style={{marginBottom:16}}>
          <p>Here you can add, view, and manage delivery agents for your platform.</p>
          <DeliveryAgentManager />
        </div>
      </>}
      {/* ...existing code... */}
    </div>

      {/* -------- PRODUCTS SECTION -------- */}
      {activeSection==="products" && <>
        <h3>📂 CSV Batches</h3>
        <input
          type="text"
          placeholder="Search by pharmacy name..."
          value={batchSearch}
          onChange={e => setBatchSearch(e.target.value)}
          style={{ marginBottom: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", width: 260 }}
        />
        {batches.length===0 ? <p>No batches yet.</p> :
        <table style={tableStyle}>
          <thead>
            <tr><th>Batch Name</th><th>Date</th><th>Uploaded By</th><th>Medicines Count</th><th>Action</th></tr>
          </thead>
          <tbody>
            {batches
              .filter(batch => {
                if (!batchSearch) return true;
                const name = (userMap[batch.uploadedBy]?.businessName || "").toLowerCase();
                return name.includes(batchSearch.toLowerCase());
              })
              .map(batch => (
                <tr key={batch.id} style={trStyle}>
                  <td>{batch.name}</td>
                  <td>{new Date(batch.date).toLocaleString()}</td>
                  <td>{userMap[batch.uploadedBy]?.businessName || batch.uploadedBy}</td>
                  <td>{batch.medicineIds?.length || 0}</td>
                  <td><button onClick={()=>handleDeleteBatch(batch)}>Delete</button></td>
                </tr>
              ))}
          </tbody>
        </table>}

        <h3 style={{marginTop:"30px"}}>💊 Medicines</h3>
        {/* Advanced filter controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Filter by name..."
            value={medNameFilter || ''}
            onChange={e => setMedNameFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', width: 160 }}
          />
          <input
            type="text"
            placeholder="Filter by ingredient..."
            value={medIngredientFilter || ''}
            onChange={e => setMedIngredientFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', width: 160 }}
          />
          <select
            value={medClassFilter || ''}
            onChange={e => setMedClassFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', width: 140 }}
          >
            <option value="">All Classes</option>
            {[...new Set(medicines.map(m => m.class).filter(Boolean))].sort().map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
          <select
            value={medPharmacyFilter || ''}
            onChange={e => setMedPharmacyFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', width: 180 }}
          >
            <option value="">All Pharmacies</option>
            {[...new Set(medicines.map(m => m.ownerId).filter(Boolean))]
              .map(ownerId => (
                <option key={ownerId} value={ownerId}>{userMap[ownerId]?.businessName || ownerId}</option>
              ))}
          </select>
        </div>
        {medicines.length===0 ? <p>No medicines yet.</p> :
        <table style={tableStyle}>
          <thead>
            <tr><th>Name</th><th>Ingredient</th><th>Class</th><th>Price (₦)</th><th>Uploaded By</th><th>Action</th></tr>
          </thead>
          <tbody>
            {medicines
              .filter(med => {
                if (medNameFilter && !med.name?.toLowerCase().includes(medNameFilter.toLowerCase())) return false;
                if (medIngredientFilter && !med.ingredient?.toLowerCase().includes(medIngredientFilter.toLowerCase())) return false;
                if (medClassFilter && med.class !== medClassFilter) return false;
                if (medPharmacyFilter && med.ownerId !== medPharmacyFilter) return false;
                return true;
              })
              .map(med => (
                <tr key={med.id} style={trStyle}>
                  <td>{med.name}</td>
                  <td>{med.ingredient}</td>
                  <td>{med.class}</td>
                  <td>{med.price}</td>
                  <td>{userMap[med.ownerId]?.businessName || med.ownerId}</td>
                  <td><button onClick={()=>handleDeleteMedicine(med)}>Delete</button></td>
                </tr>
              ))}
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
        {/* Pending / Processing Orders Collapsible */}
        <div style={{marginBottom: '18px', border: '1px solid #ddd', borderRadius: 8, background: '#fafbfc'}}>
          <div
            style={{cursor:'pointer',padding:'14px 18px',fontWeight:'bold',fontSize:18,display:'flex',alignItems:'center',userSelect:'none'}}
            onClick={()=>setOpenOrdersSection(s=>({...s,pending:!s.pending}))}
          >
            <span style={{marginRight:8}}>{openOrdersSection.pending ? '▼' : '▶'}</span>
            📦 Pending / Processing Orders
          </div>
          {openOrdersSection.pending && (
            <div style={{padding:'0 18px 18px 18px'}}>
              {/* Sorting/Filtering Controls (copied from Completed Orders) */}
              <div style={{ margin: "20px 0", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Search by user or drug name..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", width: 220 }}
                />
                <select value={orderSort} onChange={e => setOrderSort(e.target.value)} style={{ padding: "6px 12px", borderRadius: 6 }}>
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
                {/* Date Range Filter */}
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{padding:'6px 12px', borderRadius:6}} />
                <span>to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{padding:'6px 12px', borderRadius:6}} />
                {/* Medic Filter */}
                <select value={medicFilter} onChange={e => setMedicFilter(e.target.value)} style={{padding:'6px 12px', borderRadius:6}}>
                  <option value="">All Medics</option>
                  {[...verifyMedics, ...consultMedics].map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.profession})</option>
                  ))}
                </select>
                {/* Product Filter */}
                <input type="text" value={productFilter} onChange={e => setProductFilter(e.target.value)} placeholder="Product name" style={{padding:'6px 12px', borderRadius:6}} />
                {/* POM Filter */}
                <select value={pomFilter} onChange={e => setPomFilter(e.target.value)} style={{padding:'6px 12px', borderRadius:6}}>
                  <option value="">All Orders</option>
                  <option value="true">POM Only</option>
                  <option value="false">Non-POM Only</option>
                </select>
                {/* Download Button */}
                <button onClick={handleDownloadOrders} style={{padding:'8px 18px', borderRadius:6, background:'#007bff', color:'#fff', fontWeight:'bold'}}>Download CSV</button>
              </div>
              {/* Pending Orders List */}
              {filteredPendingOrders.length===0 ? <p>No pending orders.</p> :
                filteredPendingOrders.map(order=> {
                  const hasPOM = order.items?.some(i => i.isPOM);
                  const customerAddress = order.deliveryInfo ? `${order.deliveryInfo.address || ''}, ${order.deliveryInfo.city || ''}, ${order.deliveryInfo.state || ''}` : 'N/A';
                  const customerLat = order.deliveryInfo && order.deliveryInfo.lat ? order.deliveryInfo.lat : null;
                  const customerLng = order.deliveryInfo && order.deliveryInfo.lng ? order.deliveryInfo.lng : null;
                  let businessAddress = 'N/A';
                  let businessLat = null;
                  let businessLng = null;
                  if (order.businessId && userMap[order.businessId]) {
                    const b = userMap[order.businessId];
                    businessAddress = `${b.address || ''}, ${b.city || ''}, ${b.state || ''}`;
                    businessLat = b.lat || null;
                    businessLng = b.lng || null;
                  }
                  const itemsToShow = expandedOrders[order.id] ? (showAllItems[order.id] ? order.items : order.items?.slice(0, 3)) : [];
                  const hasMoreItems = order.items && order.items.length > 3;
                  return (
                    <div key={order.id} style={orderCardStyle}>
                      <p><strong>Delivery Type:</strong> {order.deliveryType ? order.deliveryType.charAt(0).toUpperCase() + order.deliveryType.slice(1) : 'N/A'}</p>
                      <div style={{display:"flex", justifyContent:"space-between",alignItems:"center"}}>
                        <p><strong>Order Date:</strong> {new Date(order.date).toLocaleString()}</p>
                        <button onClick={()=>toggleOrder(order.id)}>{expandedOrders[order.id] ? "Hide Items" : "Show Items"}</button>
                      </div>
                      <p><strong>User Email:</strong> {userMap[order.userId]?.email || order.userId}</p>
                      <p><strong>Customer Address:</strong> {
                        (!order.deliveryInfo || 
                          (!order.deliveryInfo.address && !order.deliveryInfo.city && !order.deliveryInfo.state))
                          ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span>
                          : customerAddress
                      }</p>
                      <p><strong>Customer Coordinates:</strong> {customerLat && customerLng ? `${customerLat}, ${customerLng}` : 'N/A'}</p>
                      <p><strong>Business Address:</strong> {businessAddress}</p>
                      <p><strong>Business Coordinates:</strong> {businessLat && businessLng ? `${businessLat}, ${businessLng}` : 'N/A'}</p>
                      {/* Rider assigned info */}
                      <p><strong>Rider assigned:</strong> {
                        <span style={{display:'inline-flex',alignItems:'center'}}>
                          {(() => {
                            // Prefer riderId, fallback to assignedAgentId
                            const agentId = order.riderId || order.assignedAgentId;
                            let agent = null;
                            if (agentId && userMap[agentId]) {
                              agent = userMap[agentId];
                              return `${agent.companyName || agent.name || agent.email || agentId}${(agent.phoneNumber || agent.whatsappNumber) ? ` (${[agent.phoneNumber, agent.whatsappNumber].filter(Boolean).join(' / ')})` : ''}`;
                            } else if (agentId && allAgents.length) {
                              agent = allAgents.find(a => a.id === agentId);
                              if (agent) {
                                return `${agent.companyName || agent.name || agent.id}${(agent.phoneNumber || agent.whatsappNumber) ? ` (${[agent.phoneNumber, agent.whatsappNumber].filter(Boolean).join(' / ')})` : ''}`;
                              }
                              return agentId;
                            } else if (agentId) {
                              return agentId;
                            } else {
                              return <span style={{color:'#e53935'}}>No rider assigned</span>;
                            }
                          })()}
                          <button
                            style={{marginLeft:10, background:'none', border:'none', color:'#007bff', cursor:'pointer', display:'inline-flex', alignItems:'center', fontWeight:'bold'}}
                            onClick={() => setReassignDropdown(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                          >
                            <span style={{fontSize:18, marginRight:4}}>&#x21bb;</span> reassign order
                          </button>
                          {reassignDropdown[order.id] && (
                            <select
                              style={{marginLeft:10, padding:'6px 12px', borderRadius:6}}
                              defaultValue=""
                              onChange={e => {
                                if (e.target.value) handleReassignOrder(order.id, e.target.value);
                              }}
                            >
                              <option value="">Select new rider</option>
                              {allAgents.map(agent => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.companyName || agent.name || agent.email || agent.id}
                                  {(agent.phoneNumber || agent.whatsappNumber) ? ` (${[agent.phoneNumber, agent.whatsappNumber].filter(Boolean).join(' / ')})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </span>
                      }
                      <p><strong>Order Status:</strong> {
                        (() => {
                          if ((!order.riderId && !order.assignedAgentId)) {
                            return <span style={{color:'#e53935'}}>Processing (no rider accepted)</span>;
                          }
                          if (order.status === 'cancelled' && order.cancelledBy === 'rider') {
                            return <span style={{color:'#e53935'}}>Canceled by rider</span>;
                          }
                          if (order.deliveredByRider) {
                            return <span style={{color:'#27c93f'}}>Delivered by rider</span>;
                          }
                          // Only show 'Completed' if admin marks it so
                          if (order.status === 'Completed') {
                            return <span style={{color:'#27c93f'}}>Completed (admin)</span>;
                          }
                          // If rider assigned and not completed/cancelled
                          if ((order.riderId || order.assignedAgentId) && order.status !== 'Completed' && order.status !== 'cancelled') {
                            return <span style={{color:'#007bff'}}>Progressing (rider accepted)</span>;
                          }
                          // fallback
                          return order.status;
                        })()
                      }</p>
                      {/* end rider assigned + order status */}
                      </p>
                      {expandedOrders[order.id] && order.items?.length > 0 && (
                        <div>
                          <ul style={{ maxHeight: showAllItems[order.id] ? 'none' : 120, overflowY: hasMoreItems && !showAllItems[order.id] ? 'hidden' : 'auto', marginBottom: 4 }}>
                            {itemsToShow.map((i, idx) => (
                              <li key={idx}>{i.name} - ₦{i.price} x {i.quantity||1}</li>
                            ))}
                          </ul>
                          {hasMoreItems && (
                            <button style={{ fontSize: 12, marginBottom: 8 }} onClick={() => setShowAllItems(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                              {showAllItems[order.id] ? 'Show Less' : `Show All (${order.items.length})`}
                            </button>
                          )}
                        </div>
                      )}
                      <p><strong>Total:</strong> ₦{calculateTotal(order.items||[])}
                        {hasPOM && <span style={{ color: "#e53935", marginLeft: 10 }}>[POM]</span>}
                      </p>
                      {hasPOM && (
                        <div style={{ margin: "10px 0" }}>
                          <label><strong>Medic Verified By:</strong></label>
                          <select value={selectedMedic} onChange={e => setSelectedMedic(e.target.value)} style={{ marginLeft: 10 }}>
                            <option value="">Select Medic</option>
                            {[...verifyMedics, ...consultMedics].map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.profession}) - {m.type}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button onClick={()=>completeOrder(order)}>Mark as Completed</button>
                      <button style={{marginLeft:8, background:'#e53935', color:'#fff', borderRadius:6, padding:'6px 14px', border:'none', fontWeight:'bold'}} onClick={()=>handleCancelOrder(order)}>Cancel Order</button>
                      {order.completedAt && (
                        <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
                          Completed: {new Date(order.completedAt).toLocaleString()}<br/>
                          {order.medicVerifiedBy && <span>Verified by: {verifyMedics.find(m => m.id === order.medicVerifiedBy)?.name || order.medicVerifiedBy}</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Completed Orders Collapsible */}
        <div style={{marginBottom: '18px', border: '1px solid #ddd', borderRadius: 8, background: '#fafbfc'}}>
          <div
            style={{cursor:'pointer',padding:'14px 18px',fontWeight:'bold',fontSize:18,display:'flex',alignItems:'center',userSelect:'none'}}
            onClick={()=>setOpenOrdersSection(s=>({...s,completed:!s.completed}))}
          >
            <span style={{marginRight:8}}>{openOrdersSection.completed ? '▼' : '▶'}</span>
            ✅ Completed Orders (You)
          </div>
          {openOrdersSection.completed && (
            <>
              <div style={{ margin: "20px 0", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Search by user or drug name..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", width: 220 }}
                />
                <select value={orderSort} onChange={e => setOrderSort(e.target.value)} style={{ padding: "6px 12px", borderRadius: 6 }}>
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
                {/* Date Range Filter */}
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{padding:'6px 12px', borderRadius:6}} />
                <span>to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{padding:'6px 12px', borderRadius:6}} />
                {/* Medic Filter */}
                <select value={medicFilter} onChange={e => setMedicFilter(e.target.value)} style={{padding:'6px 12px', borderRadius:6}}>
                  <option value="">All Medics</option>
                  {[...verifyMedics, ...consultMedics].map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.profession})</option>
                  ))}
                </select>
                {/* Product Filter */}
                <input type="text" value={productFilter} onChange={e => setProductFilter(e.target.value)} placeholder="Product name" style={{padding:'6px 12px', borderRadius:6}} />
                {/* POM Filter */}
                <select value={pomFilter} onChange={e => setPomFilter(e.target.value)} style={{padding:'6px 12px', borderRadius:6}}>
                  <option value="">All Orders</option>
                  <option value="true">POM Only</option>
                  <option value="false">Non-POM Only</option>
                </select>
                {/* Download Button */}
                <button onClick={handleDownloadOrders} style={{padding:'8px 18px', borderRadius:6, background:'#007bff', color:'#fff', fontWeight:'bold'}}>Download CSV</button>
              </div>
              {filteredCompletedOrders.length === 0 ? <p>No completed orders found.</p> :
                filteredCompletedOrders.map(order => {
                  const customerAddress = order.deliveryInfo ? `${order.deliveryInfo.address || ''}, ${order.deliveryInfo.city || ''}, ${order.deliveryInfo.state || ''}` : 'N/A';
                  const customerLat = order.deliveryInfo && order.deliveryInfo.lat ? order.deliveryInfo.lat : null;
                  const customerLng = order.deliveryInfo && order.deliveryInfo.lng ? order.deliveryInfo.lng : null;
                  let businessAddress = 'N/A';
                  let businessLat = null;
                  let businessLng = null;
                  if (order.businessId && userMap[order.businessId]) {
                    const b = userMap[order.businessId];
                    businessAddress = `${b.address || ''}, ${b.city || ''}, ${b.state || ''}`;
                    businessLat = b.lat || null;
                    businessLng = b.lng || null;
                  }
                  const itemsToShow = expandedOrders[order.id] ? (showAllItemsCompleted[order.id] ? order.items : order.items?.slice(0, 3)) : [];
                  const hasMoreItems = order.items && order.items.length > 3;
                  return (
                    <div key={order.id} style={orderCardStyle}>
                      <p><strong>Delivery Type:</strong> {order.deliveryType ? order.deliveryType.charAt(0).toUpperCase() + order.deliveryType.slice(1) : 'N/A'}</p>
                      <div style={{display:"flex", justifyContent:"space-between",alignItems:"center"}}>
                        <p><strong>Order Date:</strong> {new Date(order.completedAt || order.date).toLocaleString()}</p>
                        <button onClick={()=>toggleOrder(order.id)}>{expandedOrders[order.id] ? "Hide Details" : "Show Details"}</button>
                      </div>
                      <p><strong>User Email:</strong> {userMap[order.userId]?.email || order.userId}</p>
                      <p><strong>Customer Address:</strong> {
                        (!order.deliveryInfo ||
                          (!order.deliveryInfo.address && !order.deliveryInfo.city && !order.deliveryInfo.state))
                          ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span>
                          : customerAddress
                      }</p>
                      <p><strong>Customer Coordinates:</strong> {customerLat && customerLng ? `${customerLat}, ${customerLng}` : 'N/A'}</p>
                      <p><strong>Business Address:</strong> {businessAddress}</p>
                      <p><strong>Business Coordinates:</strong> {businessLat && businessLng ? `${businessLat}, ${businessLng}` : 'N/A'}</p>
                      {expandedOrders[order.id] && order.items?.length > 0 && (
                        <div>
                          <ul style={{ maxHeight: showAllItemsCompleted[order.id] ? 'none' : 120, overflowY: hasMoreItems && !showAllItemsCompleted[order.id] ? 'hidden' : 'auto', marginBottom: 4 }}>
                            {itemsToShow.map((i, idx) => (
                              <li key={idx}>{i.name} - ₦{i.price} x {i.quantity||1}</li>
                            ))}
                          </ul>
                          {hasMoreItems && (
                            <button style={{ fontSize: 12, marginBottom: 8 }} onClick={() => setShowAllItemsCompleted(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                              {showAllItemsCompleted[order.id] ? 'Show Less' : `Show All (${order.items.length})`}
                            </button>
                          )}
                        </div>
                      )}
                      <p><strong>Total:</strong> ₦{order.total || calculateTotal(order.items || [])}</p>
                      {order.medicVerifiedBy && <p><strong>Verified by:</strong> {verifyMedics.concat(consultMedics).find(m => m.id === order.medicVerifiedBy)?.name || order.medicVerifiedBy}</p>}
                      {order.completedAt && <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>Completed: {new Date(order.completedAt).toLocaleString()}</p>}
                    </div>
                  );
                })
              }
            </>
          )}
        </div>

          {/* Cancelled Orders Collapsible */}
          <div style={{marginBottom: '18px', border: '1px solid #ddd', borderRadius: 8, background: '#fafbfc'}}>
            <div
              style={{cursor:'pointer',padding:'14px 18px',fontWeight:'bold',fontSize:18,display:'flex',alignItems:'center',userSelect:'none'}}
              onClick={()=>setOpenOrdersSection(s=>({...s,cancelled:!s.cancelled}))}
            >
              <span style={{marginRight:8}}>{openOrdersSection.cancelled ? '▼' : '▶'}</span>
              ❌ Cancelled Orders
            </div>
            {openOrdersSection.cancelled && (
              <>
                <div style={{ margin: "20px 0", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Search by user or drug name..."
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", width: 220 }}
                  />
                  <select value={orderSort} onChange={e => setOrderSort(e.target.value)} style={{ padding: "6px 12px", borderRadius: 6 }}>
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="amount-desc">Highest Amount</option>
                    <option value="amount-asc">Lowest Amount</option>
                  </select>
                  {/* Date Range Filter */}
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{padding:'6px 12px', borderRadius:6}} />
                  <span>to</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{padding:'6px 12px', borderRadius:6}} />
                  {/* Medic Filter */}
                  <select value={medicFilter} onChange={e => setMedicFilter(e.target.value)} style={{padding:'6px 12px', borderRadius:6}}>
                    <option value="">All Medics</option>
                    {[...verifyMedics, ...consultMedics].map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.profession})</option>
                    ))}
                  </select>
                  {/* Product Filter */}
                  <input type="text" value={productFilter} onChange={e => setProductFilter(e.target.value)} placeholder="Product name" style={{padding:'6px 12px', borderRadius:6}} />
                  {/* POM Filter */}
                  <select value={pomFilter} onChange={e => setPomFilter(e.target.value)} style={{padding:'6px 12px', borderRadius:6}}>
                    <option value="">All Orders</option>
                    <option value="true">POM Only</option>
                    <option value="false">Non-POM Only</option>
                  </select>
                  {/* Download Button */}
                  <button onClick={handleDownloadOrders} style={{padding:'8px 18px', borderRadius:6, background:'#007bff', color:'#fff', fontWeight:'bold'}}>Download CSV</button>
                </div>
                {orders.filter(o => o.status === 'cancelled' && o.cancelledBy === 'admin').length === 0 ? <p>No cancelled orders found.</p> :
                  orders.filter(o => o.status === 'cancelled' && o.cancelledBy === 'admin').map(order => {
                    const customerAddress = order.deliveryInfo ? `${order.deliveryInfo.address || ''}, ${order.deliveryInfo.city || ''}, ${order.deliveryInfo.state || ''}` : 'N/A';
                    const customerLat = order.deliveryInfo && order.deliveryInfo.lat ? order.deliveryInfo.lat : null;
                    const customerLng = order.deliveryInfo && order.deliveryInfo.lng ? order.deliveryInfo.lng : null;
                    let businessAddress = 'N/A';
                    let businessLat = null;
                    let businessLng = null;
                    if (order.businessId && userMap[order.businessId]) {
                      const b = userMap[order.businessId];
                      businessAddress = `${b.address || ''}, ${b.city || ''}, ${b.state || ''}`;
                      businessLat = b.lat || null;
                      businessLng = b.lng || null;
                    }
                    const itemsToShow = expandedOrders[order.id] ? (showAllItemsCompleted[order.id] ? order.items : order.items?.slice(0, 3)) : [];
                    const hasMoreItems = order.items && order.items.length > 3;
                    return (
                      <div key={order.id} style={orderCardStyle}>
                        <p><strong>Delivery Type:</strong> {order.deliveryType ? order.deliveryType.charAt(0).toUpperCase() + order.deliveryType.slice(1) : 'N/A'}</p>
                        <div style={{display:"flex", justifyContent:"space-between",alignItems:"center"}}>
                          <p><strong>Order Date:</strong> {new Date(order.cancelledAt || order.date).toLocaleString()}</p>
                          <button onClick={()=>toggleOrder(order.id)}>{expandedOrders[order.id] ? "Hide Details" : "Show Details"}</button>
                        </div>
                        <p><strong>User Email:</strong> {userMap[order.userId]?.email || order.userId}</p>
                        <p><strong>Customer Address:</strong> {
                          (!order.deliveryInfo ||
                            (!order.deliveryInfo.address && !order.deliveryInfo.city && !order.deliveryInfo.state))
                            ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span>
                            : customerAddress
                        }</p>
                        <p><strong>Customer Coordinates:</strong> {customerLat && customerLng ? `${customerLat}, ${customerLng}` : 'N/A'}</p>
                        <p><strong>Business Address:</strong> {businessAddress}</p>
                        <p><strong>Business Coordinates:</strong> {businessLat && businessLng ? `${businessLat}, ${businessLng}` : 'N/A'}</p>
                        {expandedOrders[order.id] && order.items?.length > 0 && (
                          <div>
                            <ul style={{ maxHeight: showAllItemsCompleted[order.id] ? 'none' : 120, overflowY: hasMoreItems && !showAllItemsCompleted[order.id] ? 'hidden' : 'auto', marginBottom: 4 }}>
                              {itemsToShow.map((i, idx) => (
                                <li key={idx}>{i.name} - ₦{i.price} x {i.quantity||1}</li>
                              ))}
                            </ul>
                            {hasMoreItems && (
                              <button style={{ fontSize: 12, marginBottom: 8 }} onClick={() => setShowAllItemsCompleted(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                                {showAllItemsCompleted[order.id] ? 'Show Less' : `Show All (${order.items.length})`}
                              </button>
                            )}
                          </div>
                        )}
                        <p><strong>Total:</strong> ₦{order.total || calculateTotal(order.items || [])}</p>
                        {order.cancelledAt && <p style={{ fontSize: 13, color: '#e53935', marginTop: 6 }}>Cancelled: {new Date(order.cancelledAt).toLocaleString()}</p>}
                      </div>
                    );
                  })
                }
              </>
            )}
          </div>
      </>}

      {/* -------- MEDICS SECTION -------- */}
      {activeSection==="medics" && <>
        <h3>🩺 Medical Interface Profiles</h3>
        <MedicsSection />
      </>}

      {/* -------- COUPONS SECTION -------- */}
      {activeSection==="coupons" && <CouponManager />}
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

// -------- Medics Section Inline --------
function MedicsSection() {
  const [verifyMedics, setVerifyMedics] = React.useState([]);
  const [consultMedics, setConsultMedics] = React.useState([]);
  const [businessPharmacists, setBusinessPharmacists] = React.useState([]);
  const [form, setForm] = React.useState({
    section: "verify",
    photo: "",
    name: "",
    profession: "",
    license: "",
    languages: "",
    whatsapp: ""
  });
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState(null); // {id, section}

  React.useEffect(() => {
    const fetchMedics = async () => {
      const verifySnap = await getDocs(collection(db, "verifyMedics"));
      setVerifyMedics(verifySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const consultSnap = await getDocs(collection(db, "consultMedics"));
      setConsultMedics(consultSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Fetch business pharmacists
      const usersSnap = await getDocs(collection(db, "users"));
      const pharmacists = [];
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.role === "medicine-manager" && data.pharmacist) {
          pharmacists.push({
            ...data.pharmacist,
            id: d.id,
            online: true // or false if you want
          });
        }
      });
      setBusinessPharmacists(pharmacists);
    };
    fetchMedics();
  }, []);

  // Toggle online/offline status
  const toggleOnline = async (section, medic) => {
    const col = section === "verify" ? "verifyMedics" : "consultMedics";
    await updateDoc(doc(db, col, medic.id), { online: !medic.online });
    // Update local state for instant UI feedback
    if (section === "verify") {
      setVerifyMedics(meds => meds.map(m => m.id === medic.id ? { ...m, online: !medic.online } : m));
    } else {
      setConsultMedics(meds => meds.map(m => m.id === medic.id ? { ...m, online: !medic.online } : m));
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const data = {
      photo: form.photo,
      name: form.name,
      profession: form.profession,
      license: form.license,
      pharmacyName: form.pharmacyName,
      languages: form.languages.split(",").map(l => l.trim()),
      whatsapp: form.whatsapp
    };
    const col = form.section === "verify" ? "verifyMedics" : "consultMedics";
    if (editing) {
      await updateDoc(doc(db, col, editing.id), data);
    } else {
      await addDoc(collection(db, col), data);
    }
    setForm({ section: "verify", photo: "", name: "", profession: "", license: "", pharmacyName: "", languages: "", whatsapp: "" });
    setEditing(null);
    setLoading(false);
    window.location.reload();
  };

  return (
    <div style={{ padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ marginBottom: 32, background: "#f7f7f7", padding: 16, borderRadius: 8 }}>
        <h4>Add Medic Profile</h4>
        <select name="section" value={form.section} onChange={handleChange}>
          <option value="verify">Verify Prescription</option>
          <option value="consult">Get Consultation</option>
        </select>
        <input name="photo" value={form.photo} onChange={handleChange} placeholder="Photo URL" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="name" value={form.name} onChange={handleChange} placeholder="Name" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="profession" value={form.profession} onChange={handleChange} placeholder="Profession" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="license" value={form.license} onChange={handleChange} placeholder="License Number" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="pharmacyName" value={form.pharmacyName || ""} onChange={handleChange} placeholder="Pharmacy Name" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="languages" value={form.languages} onChange={handleChange} placeholder="Languages (comma separated)" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="WhatsApp Number (e.g. 2348012345678)" required style={{ width: "100%", marginBottom: 8 }} />
        <button type="submit" disabled={loading} style={{ marginTop: 10 }}>Add Medic</button>
      </form>
      <h4>Verify Prescription Medics</h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {[...verifyMedics, ...businessPharmacists].sort((a, b) => (b.online === true) - (a.online === true)).map(m => {
          let languagesArr = [];
          if (Array.isArray(m.languages)) {
            languagesArr = m.languages;
          } else if (typeof m.languages === "string") {
            languagesArr = m.languages.split(",").map(l => l.trim()).filter(Boolean);
          }
          return (
            <div key={m.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, width: 220, background: "#fff", position: "relative" }}>
              {/* Online/Offline Dot */}
              <span
                onClick={() => toggleOnline("verify", m)}
                title={m.online ? "Online" : "Offline"}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 32,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: m.online ? "#27c93f" : "#bbb",
                  border: "2px solid #fff",
                  boxShadow: "0 0 2px #888",
                  cursor: "pointer"
                }}
              />
              <img src={m.photo} alt={m.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", marginBottom: 8 }} />
              <div><b>{m.name}</b></div>
              <div>{m.profession}</div>
              <div>Pharmacy: {m.pharmacyName || <span style={{color:'#888'}}>N/A</span>}</div>
              <div>License: {m.license}</div>
              <div>Languages: {languagesArr.join(", ")}</div>
              <div><a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></div>
              <button style={{ position: "absolute", bottom: 8, right: 8, fontSize: 12 }} onClick={() => {
                setEditing({ id: m.id, section: "verify" });
                setForm({
                  section: "verify",
                  photo: m.photo,
                  name: m.name,
                  profession: m.profession,
                  license: m.license,
                  pharmacyName: m.pharmacyName,
                  languages: Array.isArray(m.languages) ? m.languages.join(", ") : m.languages,
                  whatsapp: m.whatsapp
                });
              }}>Edit</button>
            </div>
          );
        })}
      </div>
      <h4 style={{ marginTop: 24 }}>Consultation Medics</h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {[...consultMedics].sort((a, b) => (b.online === true) - (a.online === true)).map(m => {
          let languagesArr = [];
          if (Array.isArray(m.languages)) {
            languagesArr = m.languages;
          } else if (typeof m.languages === "string") {
            languagesArr = m.languages.split(",").map(l => l.trim()).filter(Boolean);
          }
          return (
            <div key={m.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, width: 220, background: "#fff", position: "relative" }}>
              {/* Online/Offline Dot */}
              <span
                onClick={() => toggleOnline("consult", m)}
                title={m.online ? "Online" : "Offline"}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 32,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: m.online ? "#27c93f" : "#bbb",
                  border: "2px solid #fff",
                  boxShadow: "0 0 2px #888",
                  cursor: "pointer"
                }}
              />
              <img src={m.photo} alt={m.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", marginBottom: 8 }} />
              <div><b>{m.name}</b></div>
              <div>{m.profession}</div>
              <div>License: {m.license}</div>
              <div>Languages: {languagesArr.join(", ")}</div>
              <div><a href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></div>
              <button style={{ position: "absolute", bottom: 8, right: 8, fontSize: 12 }} onClick={() => {
                setEditing({ id: m.id, section: "consult" });
                setForm({
                  section: "consult",
                  photo: m.photo,
                  name: m.name,
                  profession: m.profession,
                  license: m.license,
                  languages: Array.isArray(m.languages) ? m.languages.join(", ") : m.languages,
                  whatsapp: m.whatsapp
                });
              }}>Edit</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
