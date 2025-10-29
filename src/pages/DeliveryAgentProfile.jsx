import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function DeliveryAgentProfile() {
  // Current user state (must be before any useEffect that uses it)
  const [currentUser, setCurrentUser] = useState(null);
  // Track last seen order IDs to avoid duplicate notifications
  const [lastOrderIds, setLastOrderIds] = useState([]);
  // Search state (must be inside component)
  const [orderSearch, setOrderSearch] = useState("");

  // Helper: filter orders by search (must be inside component)
  function filterOrdersBySearch(ordersArr) {
    if (!orderSearch.trim()) return ordersArr;
    const q = orderSearch.trim().toLowerCase();
    return ordersArr.filter(order => {
      // Customer email
      const customerEmail = (userMap[order.userId]?.email || "").toLowerCase();
      // Pharmacy name
      const pharmacyName = (order.items && order.items[0] && businessMap[order.items[0].ownerId]?.name || "").toLowerCase();
      // Customer address
      const customerAddr = ((order.deliveryInfo?.address || "") + " " + (order.deliveryInfo?.city || "") + " " + (order.deliveryInfo?.state || "")).toLowerCase();
      // Pharmacy address
      const pharmacyAddr = (order.items && order.items[0] && ((businessMap[order.items[0].ownerId]?.address || "") + " " + (businessMap[order.items[0].ownerId]?.city || "") + " " + (businessMap[order.items[0].ownerId]?.state || "")).toLowerCase()) || "";
      // Coordinates
      const coords = [order.deliveryInfo?.lat, order.deliveryInfo?.lng, businessMap[order.items?.[0]?.ownerId]?.lat, businessMap[order.items?.[0]?.ownerId]?.lng].filter(Boolean).join(",").toLowerCase();
      // Items purchased
      const items = (order.items || []).map(i => i.name).join(", ").toLowerCase();
      return (
        customerEmail.includes(q) ||
        pharmacyName.includes(q) ||
        customerAddr.includes(q) ||
        pharmacyAddr.includes(q) ||
        coords.includes(q) ||
        items.includes(q)
      );
    });
  }
  // Accordion state for orders panels (must be at top level, before any return)
  const [openSection, setOpenSection] = React.useState('processing');
  const [businessMap, setBusinessMap] = useState({});
  // Fetch all businesses for mapping ownerId to business info
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.role === "medicine-manager") {
          map[doc.id] = {
            name: data.businessName || doc.id,
            address: data.businessAddress || data.address || "-",
            lat: data.lat || data.latitude || null,
            lng: data.lng || data.longitude || null
          };
        }
      });
      setBusinessMap(map);
    });
    return () => unsub();
  }, []);

  const [userLoading, setUserLoading] = useState(true);
  // Real-time notification for new express orders (unassigned)
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      setUserLoading(false);
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (userLoading || !currentUser) return;
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Only express, processing, unassigned orders
      const relevantOrders = orders.filter(order =>
        order.status === "Processing" &&
        !order.assignedAgentId &&
        order.deliveryType && order.deliveryType.toLowerCase() === "express"
      );
      // Only notify for new orders
      const newOrders = relevantOrders.filter(order => !lastOrderIds.includes(order.id));
      if (newOrders.length > 0) {
        newOrders.forEach(order => {
          toast.info(`🚚 New express delivery order! Order ID: ${order.id}`);
        });
        setLastOrderIds(prev => [...prev, ...newOrders.map(o => o.id)]);
      }
    });
    return () => unsub();
  }, [userLoading, currentUser, lastOrderIds]);
  const [userMap, setUserMap] = useState({});
  // Fetch all users for mapping userId to email
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        map[doc.id] = data.email || doc.id;
      });
      setUserMap(map);
    });
    return () => unsub();
  }, []);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [progressOrders, setProgressOrders] = useState([]);
  // Local state for agent-canceled orders (persisted in localStorage as full objects)
  const [canceledOrdersLocal, setCanceledOrdersLocal] = useState(() => {
    const saved = localStorage.getItem('agentCanceledOrders');
    return saved ? JSON.parse(saved) : [];
  });

  // Per-order success and notification state for progression orders
  const [orderSuccessState, setOrderSuccessState] = useState({});
  const [orderNotifState, setOrderNotifState] = useState({});
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const { slug } = useParams();
  const [agent, setAgent] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('availability');


  // Real-time listeners for all order states
  useEffect(() => {
    if (userLoading || !currentUser) return;
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompletedOrders(all.filter(order => order.status === "Completed" && order.assignedAgentId === currentUser.uid));
      setProgressOrders(all.filter(order => order.status === "In-Progress" && order.assignedAgentId === currentUser.uid));
      // Only show processing orders not canceled by this agent in this session
      setOrders(all.filter(order => order.status === "Processing" && !order.assignedAgentId && !canceledOrdersLocal.some(o => o.id === order.id) && order.deliveryType && order.deliveryType.toLowerCase() === "express"));
    });
    return () => unsub();
  }, [userLoading, currentUser, canceledOrdersLocal]);

  // Accept order handler (moves to In-Progress)
  const handleAcceptOrder = async (orderId) => {
    setAcceptingOrderId(orderId);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        assignedAgentId: currentUser.uid,
        riderId: currentUser.uid,
        assignedAgentSlug: agent.slug,
        assignedAgentName: agent.companyName,
        companyName: agent.companyName,
        agentPhoneNumber: agent.phoneNumber || "",
        agentWhatsappNumber: agent.whatsappNumber || "",
        assignedAt: new Date().toISOString(),
        status: "In-Progress",
      });
      toast.success("Order accepted!");
    } catch (err) {
      toast.error("Failed to accept order");
    }
    setAcceptingOrderId(null);
  };

  // Mark order as success (moves to Completed)
  // Mark order as delivered by rider (does NOT move to Completed for admin/customer)
  const handleOrderSuccess = async (orderId) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        deliveredByRider: true,
        riderCompletedAt: new Date().toISOString(),
      });
      toast.success("Order marked as delivered!");
    } catch (err) {
      toast.error("Failed to mark as delivered");
    }
  };

  // Mark order as failed (moves back to Processing)
  const handleOrderFailed = async (orderId) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "Processing",
        assignedAgentId: null,
        assignedAgentSlug: null,
        assignedAgentName: null,
        assignedAt: null,
      });
      toast.info("Order moved back to processing.");
    } catch (err) {
      toast.error("Failed to move order back to processing");
    }
  };

  // Cancel order handler (local to agent session)
  const handleCancelOrder = (orderId) => {
    // Find the order in the current orders list
    const order = orders.find(o => o.id === orderId) || progressOrders.find(o => o.id === orderId);
    if (!order) return;
    setCanceledOrdersLocal(prev => {
      const updated = [...prev, order];
      localStorage.setItem('agentCanceledOrders', JSON.stringify(updated));
      return updated;
    });
    setOpenSection('canceled');
  };
  // Keep canceledOrdersLocal in sync with localStorage if changed elsewhere
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'agentCanceledOrders') {
        setCanceledOrdersLocal(e.newValue ? JSON.parse(e.newValue) : []);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Toggle availability handler
  const handleToggleAvailability = async () => {
    if (!agent) return;
    setAvailabilityLoading(true);
    try {
      const agentRef = doc(db, "deliveryAgents", agent.id);
      await updateDoc(agentRef, { available: !agent.available });
      setAgent({ ...agent, available: !agent.available });
      toast.success("Availability updated.");
    } catch (err) {
      toast.error("Failed to update availability");
    }
    setAvailabilityLoading(false);
  };

  useEffect(() => {
    async function fetchAgent() {
      setLoading(true);
      // Debug: fetch all agents and log their slugs
      const allSnap = await getDocs(collection(db, "deliveryAgents"));
      const allAgents = allSnap.docs.map(doc => doc.data());
      console.log("All agent slugs:", allAgents.map(a => a.slug));
      // Now run the slug query
      const q = query(collection(db, "deliveryAgents"), where("slug", "==", slug), where("approved", "==", true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setAgent({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setAgent(null);
      }
      setLoading(false);
    }
    fetchAgent();
  }, [slug]);

  if (loading || userLoading) return <div style={{padding:40}}>Loading...</div>;
  if (!agent) return <div style={{padding:40, color:'#e53935'}}>No delivery agent found for this slug.</div>;
  if (!currentUser || currentUser.uid !== agent.userId) {
    return <div style={{padding:40, color:'#e53935'}}>Access denied. You can only view your own profile.</div>;
  }



  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
      <h2>🚚 Delivery Agent Profile</h2>
      <img src={agent.logoUrl || "https://via.placeholder.com/80x80?text=Logo"} alt="Business Logo" style={{ width: 80, height: 80, borderRadius: '10px', objectFit: 'cover', marginBottom: 10 }} />
      <div style={{ fontWeight: 'bold', fontSize: 18 }}>{agent.companyName}</div>
      <div>Phone: {agent.phoneNumber}</div>
      <div>WhatsApp: {agent.whatsappNumber}</div>
      <div>RC Number: {agent.rcNumber}</div>
      <div>Address: {agent.businessAddress}</div>
      <div>Email: {agent.email}</div>
      <div>Coverage: {agent.coverageArea}</div>
      <div>Hours: {agent.operatingHours}</div>
      {/* Tabs */}
      <div style={{display:'flex',marginTop:30,gap:20}}>
        <button 
          style={{padding:'10px 30px',fontWeight:'bold',borderRadius:8,border:activeTab==='availability'?'2px solid #1976d2':'1px solid #ccc',background:activeTab==='availability'?'#e3f2fd':'#fff',cursor:'pointer'}} 
          onClick={()=>setActiveTab('availability')}
        >Agent Availability</button>
        <button 
          style={{padding:'10px 30px',fontWeight:'bold',borderRadius:8,border:activeTab==='orders'?'2px solid #1976d2':'1px solid #ccc',background:activeTab==='orders'?'#e3f2fd':'#fff',cursor:'pointer'}} 
          onClick={()=>setActiveTab('orders')}
        >Agent Orders</button>
      </div>
      <div style={{display:'flex',marginTop:30,gap:40}}>
        {/* Availability Section */}
        {activeTab==='availability' && (
          <div style={{flex:1,minWidth:320}}>
            <h3>Agent Availability</h3>
            <div style={{marginTop:10}}>
              <span style={{fontWeight:'bold'}}>Status:</span> {agent.available ? "✅ Available" : "❌ Not Available"}
              <button 
                style={{marginLeft:16,padding:'6px 18px',fontWeight:'bold'}} 
                onClick={handleToggleAvailability} 
                disabled={availabilityLoading}
              >
                {agent.available ? "Set Not Available" : "Set Available"}
              </button>
            </div>
          </div>
        )}
        {/* Orders Section */}
        {activeTab==='orders' && (
          agent.available ? (
            <div style={{display:'flex', flexDirection:'row', alignItems:'flex-start', width:'100%'}}>
              {/* Left: Small vertical buttons */}
              <div style={{display:'flex', flexDirection:'column', gap:10, minWidth:160}}>
              {/* Search bar for all order sections - now placed above order panels, not blocking anything */}
              <div style={{flex:1, marginLeft:24, marginBottom:16}}>
                <input
                  type="text"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Search orders by customer email, pharmacy, address, coordinates, items..."
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #bbb',borderRadius:6,fontSize:15,outline:'none',boxShadow:'0 1px 2px #0001'}}
                />
              </div>
                <button onClick={()=>setOpenSection('processing')} style={{padding:'6px 10px',fontWeight:'bold',fontSize:13,borderRadius:6,border:openSection==='processing'?'2px solid #1976d2':'1px solid #ccc',background:openSection==='processing'?'#e3f2fd':'#fff',cursor:'pointer',textAlign:'left'}}>📦 Orders (Processing)</button>
                <button onClick={()=>setOpenSection('progression')} style={{padding:'6px 10px',fontWeight:'bold',fontSize:13,borderRadius:6,border:openSection==='progression'?'2px solid #1976d2':'1px solid #ccc',background:openSection==='progression'?'#e3f2fd':'#fff',cursor:'pointer',textAlign:'left'}}>⏳ Order Progression</button>
                <button onClick={()=>setOpenSection('completed')} style={{padding:'6px 10px',fontWeight:'bold',fontSize:13,borderRadius:6,border:openSection==='completed'?'2px solid #1976d2':'1px solid #ccc',background:openSection==='completed'?'#e3f2fd':'#fff',cursor:'pointer',textAlign:'left'}}>✅ Completed Orders (You)</button>
                <button onClick={()=>setOpenSection('canceled')} style={{padding:'6px 10px',fontWeight:'bold',fontSize:13,borderRadius:6,border:openSection==='canceled'?'2px solid #1976d2':'1px solid #ccc',background:openSection==='canceled'?'#e3f2fd':'#fff',cursor:'pointer',textAlign:'left'}}>❌ Canceled Orders</button>
              </div>
              {openSection === 'canceled' && (
                <div style={{minWidth:320, maxWidth:600, marginTop:56, marginLeft:5}}>
                  {filterOrdersBySearch(canceledOrdersLocal).length === 0 ? (
                    <div style={{marginBottom:20, color:'#888'}}>No canceled orders found.</div>
                  ) : (
                    filterOrdersBySearch(canceledOrdersLocal).map(order => (
                      <div key={order.id} style={{border:'1px solid #b91c1c', borderRadius:8, padding:16, marginBottom:16, background:'#fff0f0'}}>
                        <div style={{fontWeight:'bold',marginBottom:8}}>Order #{order.id}</div>
                        <div style={{display:'flex',alignItems:'flex-start'}}>
                          {/* Vertical anchor line */}
                          <div style={{position:'relative',width:24,display:'flex',flexDirection:'column',alignItems:'center',marginRight:12}}>
                            <div style={{width:10,height:10,borderRadius:'50%',background:'#1976d2',marginBottom:8,marginTop:2}}></div>
                            <div style={{flex:1,width:2,background:'#b91c1c',minHeight:32}}></div>
                            <div style={{width:10,height:10,borderRadius:'50%',background:'#b91c1c',marginTop:8}}></div>
                          </div>
                          <div style={{flex:1}}>
                            {/* FROM (Business) */}
                            <div style={{marginBottom:18}}>
                              <div style={{fontSize:13,letterSpacing:1,color:'#1976d2',fontWeight:700,marginBottom:2}}>FROM</div>
                              {order.items && order.items.length > 0 && businessMap[order.items[0].ownerId] && (() => {
                                const b = businessMap[order.items[0].ownerId];
                                const businessAddress = `${b.address || ''}, ${b.city || ''}, ${b.state || ''}`;
                                const missingBusinessAddress = !b.address && !b.city && !b.state;
                                return (
                                  <div style={{marginLeft:2}}>
                                    <div style={{fontWeight:600}}>{b.name}</div>
                                    <div style={{fontSize:13,color:'#555'}}>{missingBusinessAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this business</span> : businessAddress}</div>
                                    {b.lat && b.lng && (
                                      <div style={{fontSize:12,color:'#1976d2',marginTop:2}}>Coordinates: {b.lat}, {b.lng}</div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {/* TO (Customer) */}
                            <div>
                              <div style={{fontSize:13,letterSpacing:1,color:'#059669',fontWeight:700,marginBottom:2}}>TO</div>
                              <div style={{marginLeft:2}}>
                                <div style={{fontWeight:600}}>{order.customerName || userMap[order.userId] || order.userId}</div>
                                {(() => {
                                  const info = order.deliveryInfo || {};
                                  const customerAddress = `${info.address || ''}, ${info.city || ''}, ${info.state || ''}`;
                                  const missingAddress = !info.address && !info.city && !info.state;
                                  return <>
                                    <div style={{fontSize:13,color:'#555'}}>{missingAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span> : customerAddress}</div>
                                    {info.lat && info.lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {info.lat}, {info.lng}</div>
                                    ) : userMap[order.userId] && userMap[order.userId].lat && userMap[order.userId].lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {userMap[order.userId].lat}, {userMap[order.userId].lng} <span style={{color:'#888'}}>(profile)</span></div>
                                    ) : (
                                      <div style={{fontSize:12,color:'#b91c1c',marginTop:2}}>Coordinates not available</div>
                                    )}
                                  </>;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{marginTop:18}}>Items: {order.items?.map(i => `${i.name} x${i.quantity||1}`).join(", ")}</div>
                        <div>Status: <span style={{color:'#b91c1c'}}>Canceled (local)</span></div>
                        <div style={{marginTop:10, fontSize:13, color:'#555'}}>
                          Canceled (local, not global)
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {/* Right: Panels */}
              <div style={{flex:1, marginLeft:24}}>

              {/* Panels */}
              {openSection === 'processing' && (
                <div style={{minWidth:320, maxWidth:600, marginTop:56, marginLeft:5}}>
                  {filterOrdersBySearch(orders).length === 0 ? (
                    <div style={{marginBottom:20, color:'#888'}}>No processing orders found.</div>
                  ) : (
                    filterOrdersBySearch(orders).map(order => (
                      <div key={order.id} style={{border:'1px solid #ccc', borderRadius:8, padding:16, marginBottom:16, background:'#fcfcfc'}}>
                        {/* ...existing code for order card... */}
                        <div style={{fontWeight:'bold',marginBottom:8}}>Order #{order.id}</div>
                        <div><strong>Delivery Type (debug):</strong> {typeof order.deliveryType} | {JSON.stringify(order.deliveryType)}</div>
                        <div style={{display:'flex',alignItems:'flex-start'}}>
                          {/* Vertical anchor line */}
                          <div style={{position:'relative',width:24,display:'flex',flexDirection:'column',alignItems:'center',marginRight:12}}>
                            <div style={{width:10,height:10,borderRadius:'50%',background:'#1976d2',marginBottom:8,marginTop:2}}></div>
                            <div style={{flex:1,width:2,background:'#d1d5db',minHeight:32}}></div>
                            <div style={{width:10,height:10,borderRadius:'50%',background:'#059669',marginTop:8}}></div>
                          </div>
                          <div style={{flex:1}}>
                            {/* FROM (Business) */}
                            <div style={{marginBottom:18}}>
                              <div style={{fontSize:13,letterSpacing:1,color:'#1976d2',fontWeight:700,marginBottom:2}}>FROM</div>
                              {order.items && order.items.length > 0 && businessMap[order.items[0].ownerId] && (() => {
                                const b = businessMap[order.items[0].ownerId];
                                const businessAddress = `${b.address || ''}, ${b.city || ''}, ${b.state || ''}`;
                                const missingBusinessAddress = !b.address && !b.city && !b.state;
                                return (
                                  <div style={{marginLeft:2}}>
                                    <div style={{fontWeight:600}}>{b.name}</div>
                                    <div style={{fontSize:13,color:'#555'}}>{missingBusinessAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this business</span> : businessAddress}</div>
                                    {b.lat && b.lng && (
                                      <div style={{fontSize:12,color:'#1976d2',marginTop:2}}>Coordinates: {b.lat}, {b.lng}</div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {/* TO (Customer) */}
                            <div>
                              <div style={{fontSize:13,letterSpacing:1,color:'#059669',fontWeight:700,marginBottom:2}}>TO</div>
                              <div style={{marginLeft:2}}>
                                <div style={{fontWeight:600}}>{order.customerName || userMap[order.userId] || order.userId}</div>
                                {(() => {
                                  const info = order.deliveryInfo || {};
                                  const customerAddress = `${info.address || ''}, ${info.city || ''}, ${info.state || ''}`;
                                  const missingAddress = !info.address && !info.city && !info.state;
                                  // Try order.deliveryInfo.lat/lng, else fallback to user profile
                                  let lat = info.lat, lng = info.lng;
                                  return <>
                                    <div style={{fontSize:13,color:'#555'}}>{missingAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span> : customerAddress}</div>
                                    {lat && lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {lat}, {lng}</div>
                                    ) : userMap[order.userId] && userMap[order.userId].lat && userMap[order.userId].lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {userMap[order.userId].lat}, {userMap[order.userId].lng} <span style={{color:'#888'}}>(profile)</span></div>
                                    ) : (
                                      <div style={{fontSize:12,color:'#b91c1c',marginTop:2}}>Coordinates not available</div>
                                    )}
                                  </>;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{marginTop:18}}>Items: {order.items?.map(i => `${i.name} x${i.quantity||1}`).join(", ")}</div>
                        <div>Status: <span style={{color:'#e53935'}}>{order.status}</span></div>
                        <div style={{marginTop:10, display:'flex', gap:12}}>
                          <button 
                            style={{fontWeight:'bold', background:'#1976d2', color:'#fff', border:'none', borderRadius:6, padding:'6px 18px', cursor:'pointer'}} 
                            onClick={()=>handleAcceptOrder(order.id)} 
                            disabled={acceptingOrderId===order.id}
                          >
                            {acceptingOrderId===order.id ? "Accepting..." : "Accept Order"}
                          </button>
                          <button 
                            style={{fontWeight:'bold', background:'#b91c1c', color:'#fff', border:'none', borderRadius:6, padding:'6px 18px', cursor:'pointer'}} 
                            onClick={()=>handleCancelOrder(order.id)}
                          >
                            Cancel Order
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {openSection === 'progression' && (
                <div style={{minWidth:320, maxWidth:600, marginTop:56, marginLeft:5}}>
                  {filterOrdersBySearch(progressOrders).length === 0 ? (
                    <div style={{marginBottom:20, color:'#888'}}>No in-progress orders found.</div>
                  ) : (
filterOrdersBySearch(progressOrders).map(order => {
                      const successState = !!orderSuccessState[order.id];
                      const showNotif = !!orderNotifState[order.id];
                      const handleSuccessClick = async () => {
                        await handleOrderSuccess(order.id);
                        setOrderSuccessState(prev => ({ ...prev, [order.id]: true }));
                        setOrderNotifState(prev => ({ ...prev, [order.id]: true }));
                        setTimeout(() => setOrderNotifState(prev => ({ ...prev, [order.id]: false })), 2000);
                      };
                      return (
                        <div key={order.id} style={{border:'1px solid #f59e42', borderRadius:8, padding:16, marginBottom:16, background:'#fffbe6'}}>
                          {/* ...existing code for order progression card... */}
                          <div style={{fontWeight:'bold',marginBottom:8}}>Order #{order.id}</div>
                          <div style={{display:'flex',alignItems:'flex-start'}}>
                            {/* ...existing code for FROM/TO ... */}
                            {/* FROM (Business) */}
                            <div style={{marginBottom:18}}>
                              <div style={{fontSize:13,letterSpacing:1,color:'#1976d2',fontWeight:700,marginBottom:2}}>FROM</div>
                              {order.items && order.items.length > 0 && businessMap[order.items[0].ownerId] && (() => {
                                const b = businessMap[order.items[0].ownerId];
                                const businessAddress = `${b.address || ''}, ${b.city || ''}, ${b.state || ''}`;
                                const missingBusinessAddress = !b.address && !b.city && !b.state;
                                return (
                                  <div style={{marginLeft:2}}>
                                    <div style={{fontWeight:600}}>{b.name}</div>
                                    <div style={{fontSize:13,color:'#555'}}>{missingBusinessAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this business</span> : businessAddress}</div>
                                    {b.lat && b.lng && (
                                      <div style={{fontSize:12,color:'#1976d2',marginTop:2}}>Coordinates: {b.lat}, {b.lng}</div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {/* TO (Customer) */}
                            <div>
                              <div style={{fontSize:13,letterSpacing:1,color:'#059669',fontWeight:700,marginBottom:2}}>TO</div>
                              <div style={{marginLeft:2}}>
                                <div style={{fontWeight:600}}>{order.customerName || userMap[order.userId] || order.userId}</div>
                                {(() => {
                                  const info = order.deliveryInfo || {};
                                  const customerAddress = `${info.address || ''}, ${info.city || ''}, ${info.state || ''}`;
                                  const missingAddress = !info.address && !info.city && !info.state;
                                  let lat = info.lat, lng = info.lng;
                                  return <>
                                    <div style={{fontSize:13,color:'#555'}}>{missingAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span> : customerAddress}</div>
                                    {lat && lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {lat}, {lng}</div>
                                    ) : userMap[order.userId] && userMap[order.userId].lat && userMap[order.userId].lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {userMap[order.userId].lat}, {userMap[order.userId].lng} <span style={{color:'#888'}}>(profile)</span></div>
                                    ) : (
                                      <div style={{fontSize:12,color:'#b91c1c',marginTop:2}}>Coordinates not available</div>
                                    )}
                                  </>;
                                })()}
                              </div>
                            </div>
                          </div>
                          <div style={{marginTop:18}}>Items: {order.items?.map(i => `${i.name} x${i.quantity||1}`).join(", ")}</div>
                          <div>Status: <span style={{color:'#f59e42'}}>{order.status}</span></div>
                          <div style={{marginTop:10, display:'flex', gap:12}}>
                            <button 
                              style={{fontWeight:'bold', background:'#059669', color:'#fff', border:'none', borderRadius:6, padding:'6px 18px', cursor: successState ? 'not-allowed' : 'pointer', opacity: successState ? 0.5 : 1}} 
                              onClick={handleSuccessClick} 
                              disabled={successState}
                            >Success</button>
                            <button 
                              style={{fontWeight:'bold', background:'#e53935', color:'#fff', border:'none', borderRadius:6, padding:'6px 18px', cursor: successState ? 'not-allowed' : 'pointer', opacity: successState ? 0.5 : 1}} 
                              onClick={()=>handleOrderFailed(order.id)}
                              disabled={successState}
                            >Failed</button>
                          </div>
                          {showNotif && (
                            <div style={{marginTop:8, color:'#059669', fontWeight:'bold'}}>Order successful!</div>
                          )}
                          {successState && (
                            <div style={{marginTop:8, color:'#1976d2', fontSize:13}}>
                              Successful order: to be confirmed by admin
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {openSection === 'completed' && (
                <div style={{minWidth:320, maxWidth:600, marginTop:56, marginLeft:5}}>
                  {filterOrdersBySearch(completedOrders).length === 0 ? (
                    <div style={{marginBottom:20, color:'#888'}}>No completed orders found.</div>
                  ) : (
                    filterOrdersBySearch(completedOrders).map(order => (
                      <div key={order.id} style={{border:'1px solid #4caf50', borderRadius:8, padding:16, marginBottom:16, background:'#e8f5e9'}}>
                        {/* ...existing code for completed order card... */}
                        <div style={{fontWeight:'bold',marginBottom:8}}>Order #{order.id}</div>
                        <div style={{display:'flex',alignItems:'flex-start'}}>
                          {/* Vertical anchor line */}
                          <div style={{position:'relative',width:24,display:'flex',flexDirection:'column',alignItems:'center',marginRight:12}}>
                            <div style={{width:10,height:10,borderRadius:'50%',background:'#1976d2',marginBottom:8,marginTop:2}}></div>
                            <div style={{flex:1,width:2,background:'#b2dfdb',minHeight:32}}></div>
                            <div style={{width:10,height:10,borderRadius:'50%',background:'#059669',marginTop:8}}></div>
                          </div>
                          <div style={{flex:1}}>
                            {/* FROM (Business) */}
                            <div style={{marginBottom:18}}>
                              <div style={{fontSize:13,letterSpacing:1,color:'#1976d2',fontWeight:700,marginBottom:2}}>FROM</div>
                              {order.items && order.items.length > 0 && businessMap[order.items[0].ownerId] && (() => {
                                const b = businessMap[order.items[0].ownerId];
                                const businessAddress = `${b.address || ''}, ${b.city || ''}, ${b.state || ''}`;
                                const missingBusinessAddress = !b.address && !b.city && !b.state;
                                return (
                                  <div style={{marginLeft:2}}>
                                    <div style={{fontWeight:600}}>{b.name}</div>
                                    <div style={{fontSize:13,color:'#555'}}>{missingBusinessAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this business</span> : businessAddress}</div>
                                    {b.lat && b.lng && (
                                      <div style={{fontSize:12,color:'#1976d2',marginTop:2}}>Coordinates: {b.lat}, {b.lng}</div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {/* TO (Customer) */}
                            <div>
                              <div style={{fontSize:13,letterSpacing:1,color:'#059669',fontWeight:700,marginBottom:2}}>TO</div>
                              <div style={{marginLeft:2}}>
                                <div style={{fontWeight:600}}>{order.customerName || userMap[order.userId] || order.userId}</div>
                                {(() => {
                                  const info = order.deliveryInfo || {};
                                  const customerAddress = `${info.address || ''}, ${info.city || ''}, ${info.state || ''}`;
                                  const missingAddress = !info.address && !info.city && !info.state;
                                  return <>
                                    <div style={{fontSize:13,color:'#555'}}>{missingAddress ? <span style={{color:'red',fontWeight:600}}>⚠️ Address missing for this order</span> : customerAddress}</div>
                                    {info.lat && info.lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {info.lat}, {info.lng}</div>
                                    ) : userMap[order.userId] && userMap[order.userId].lat && userMap[order.userId].lng ? (
                                      <div style={{fontSize:12,color:'#059669',marginTop:2}}>Coordinates: {userMap[order.userId].lat}, {userMap[order.userId].lng} <span style={{color:'#888'}}>(profile)</span></div>
                                    ) : (
                                      <div style={{fontSize:12,color:'#b91c1c',marginTop:2}}>Coordinates not available</div>
                                    )}
                                  </>;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{marginTop:18}}>Items: {order.items?.map(i => `${i.name} x${i.quantity||1}`).join(", ")}</div>
                        <div>Status: <span style={{color:'#388e3c'}}>{order.status}</span></div>
                        <div style={{marginTop:10, fontSize:13, color:'#555'}}>
                          Completed: {order.completedAt ? new Date(order.completedAt).toLocaleString() : "-"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              </div>

            </div>
          ) : (
            <div style={{padding:40, color:'#e53935', width:'100%'}}>You must be <b>Available</b> to view and accept orders.</div>
          )
        )}
      </div>
    </div>
  );
}
