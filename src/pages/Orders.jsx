import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";

// Format timestamp to "time ago" or full local date
const timeAgoOrDate = (timestamp) => {
  if (!timestamp) return "Unknown date";
  const now = new Date();
  const orderTime = new Date(timestamp);
  const diff = now - orderTime;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return orderTime.toLocaleString();
};

export default function Orders() {
  const [user, setUser] = useState(null); // 🔹 Declare user first
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("Pending");
  const [expandedOrders, setExpandedOrders] = useState({});
  const auth = getAuth();

  // 🔹 Listen for auth changes and fetch orders
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
        const unsubscribeOrders = onSnapshot(q, (snapshot) => {
          const orderList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          orderList.sort((a, b) => new Date(b.date) - new Date(a.date));
          setOrders(orderList);
        });

        // Clean up orders listener
        return () => unsubscribeOrders();
      }
    });

    return () => unsubscribeAuth();
  }, [auth]);

  // 🔹 If user is not logged in
  if (!user) return <p>Please log in to view your orders.</p>;

  const cancelOrder = async (orderId) => {
    const confirmCancel = window.confirm("Are you sure you want to cancel this order?");
    if (!confirmCancel) return;
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, { status: "Cancelled" });
    alert("✅ Order cancelled and moved to Cancelled tab");
  };

  const toggleOrder = (orderId) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const calculateTotal = (items) =>
    items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

  const statuses = ["Pending", "Processing", "Completed", "Cancelled"];
  const ordersByStatus = statuses.reduce((acc, status) => {
    if (status === "Processing") {
      // Show both Processing and In-Progress orders in Processing tab
      acc[status] = orders.filter((o) => {
        const s = o.status || "Pending";
        return s === "Processing" || s === "In-Progress";
      });
    } else {
      acc[status] = orders.filter((o) => (o.status || "Pending") === status);
    }
    return acc;
  }, {});

  return (
    <div style={{ padding: "30px" }}>
      <h2>📦 Your Orders</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
              borderRadius: "5px",
              border: "none",
              background: activeTab === status ? "#007bff" : "#eee",
              color: activeTab === status ? "#fff" : "#000",
              fontWeight: activeTab === status ? "bold" : "normal",
            }}
          >
            {status} ({ordersByStatus[status]?.length || 0})
          </button>
        ))}
      </div>

      {/* Orders list */}
      {ordersByStatus[activeTab].length === 0 ? (
        <p>No {activeTab.toLowerCase()} orders.</p>
      ) : (
        ordersByStatus[activeTab].map((order) => (
          <div
            key={order.id}
            style={{
              marginBottom: "32px",
              padding: "0",
              border: "none",
              borderRadius: "18px",
              background: "#fff",
              boxShadow: "0 4px 24px 0 rgba(124,58,237,0.08)",
              overflow: "hidden",
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
              position: "relative"
            }}
          >
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, #ede9fe 0%, #f4f6fb 100%)',
              padding: '20px 28px 12px 28px',
              borderBottom: '1px solid #e0e7ff',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              minHeight: 60
            }}>
              <div style={{ fontWeight: 600, color: '#7c3aed', fontSize: 17, letterSpacing: 0.2 }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Order Date:</span> {timeAgoOrDate(order.date)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 }}>
                <div style={{ fontSize: '0.97em', marginBottom: 2 }}>
                  <strong style={{ color: '#6366f1' }}>Medicines provided by:</strong>
                  {order.items && order.items.length > 0 ? (
                    <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                      {Array.from(
                        order.items.reduce((acc, item) => {
                          const name = item.businessName || "Unknown";
                          const phone = item.businessPhone || item.phoneNumber || "N/A";
                          const whatsapp = item.businessWhatsapp || item.whatsappNumber || "N/A";
                          acc.set(name + "__" + phone + "__" + whatsapp, { name, phone, whatsapp });
                          return acc;
                        }, new Map()).values()
                      ).map(({ name, phone, whatsapp }) => (
                        <li key={name + phone + whatsapp} style={{ margin: 0, padding: 0, fontSize: 15, color: '#222' }}>
                          {name} (
                          {phone && phone !== "N/A" ? (
                            <a href={`tel:${phone}`} style={{ color: '#007bff', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <span style={{ verticalAlign: 'middle' }}>{phone}</span>
                              <span style={{ fontSize: '1em', marginLeft: 2, verticalAlign: 'middle' }}>
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline', verticalAlign: 'middle' }}><path d="M3.654 1.328a.678.678 0 0 1 .58-.326h2.222c.27 0 .513.162.608.41l1.013 2.53a.678.678 0 0 1-.145.72l-1.013 1.013a11.42 11.42 0 0 0 4.292 4.292l1.013-1.013a.678.678 0 0 1 .72-.145l2.53 1.013a.678.678 0 0 1 .41.608v2.222a.678.678 0 0 1-.326.58l-2.222 1.333a2.034 2.034 0 0 1-2.03.06c-2.29-1.19-4.13-3.03-5.32-5.32a2.034 2.034 0 0 1 .06-2.03L3.654 1.328z" stroke="#007bff" strokeWidth="1.2" fill="none"/></svg>
                              </span>
                            </a>
                          ) : (
                            <span>N/A</span>
                          )}
                          {', '}
                          {whatsapp && whatsapp !== "N/A" ? (
                            <a href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <span style={{ verticalAlign: 'middle' }}>{whatsapp}</span>
                              <span style={{ fontSize: '1em', marginLeft: 2, verticalAlign: 'middle' }}>
                                <svg width="13" height="13" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline', verticalAlign: 'middle' }}><path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.832 4.584 2.236 6.393L4 29l7.828-2.236A11.96 11.96 0 0 0 16 27c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 21.5c-1.77 0-3.45-.46-4.91-1.26l-.35-.2-4.65 1.33 1.33-4.65-.2-.35A8.97 8.97 0 0 1 7 15c0-4.963 4.037-9 9-9s9 4.037 9 9-4.037 9-9 9zm5.07-6.36c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.4-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47-.16-.01-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3 0 1.36.98 2.68 1.12 2.87.14.18 1.93 2.95 4.68 4.02.65.28 1.16.45 1.56.58.66.21 1.26.18 1.73.11.53-.08 1.65-.67 1.88-1.32.23-.65.23-1.21.16-1.32-.07-.11-.25-.18-.53-.32z" fill="#25D366"/></svg>
                              </span>
                            </a>
                          ) : (
                            <span>N/A</span>
                          )}
                          )
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span>Unknown</span>
                  )}
                </div>
                <span style={{ fontSize: "0.97em", marginTop: 6 }}>
                  <strong style={{ color: '#6366f1' }}>Delivery agent:</strong> {order.assignedAgentName || order.riderName || order.riderId || order.assignedAgentId || "Not assigned"}
                  {(order.assignedAgentName || order.riderName || order.riderId || order.assignedAgentId) && (order.agentPhoneNumber || order.agentWhatsappNumber) && (
                    <>
                      {' ('}
                      {order.agentPhoneNumber ? (
                        <a href={`tel:${order.agentPhoneNumber}`} style={{ color: '#007bff', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ verticalAlign: 'middle' }}>{order.agentPhoneNumber}</span>
                          <span style={{ fontSize: '1em', marginLeft: 2, verticalAlign: 'middle' }}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline', verticalAlign: 'middle' }}><path d="M3.654 1.328a.678.678 0 0 1 .58-.326h2.222c.27 0 .513.162.608.41l1.013 2.53a.678.678 0 0 1-.145.72l-1.013 1.013a11.42 11.42 0 0 0 4.292 4.292l1.013-1.013a.678.678 0 0 1 .72-.145l2.53 1.013a.678.678 0 0 1 .41.608v2.222a.678.678 0 0 1-.326.58l-2.222 1.333a2.034 2.034 0 0 1-2.03.06c-2.29-1.19-4.13-3.03-5.32-5.32a2.034 2.034 0 0 1 .06-2.03L3.654 1.328z" stroke="#007bff" strokeWidth="1.2" fill="none"/></svg>
                          </span>
                        </a>
                      ) : (
                        <span>N/A</span>
                      )}
                      {', '}
                      {order.agentWhatsappNumber ? (
                        <a href={`https://wa.me/${order.agentWhatsappNumber.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ verticalAlign: 'middle' }}>{order.agentWhatsappNumber}</span>
                          <span style={{ fontSize: '1em', marginLeft: 2, verticalAlign: 'middle' }}>
                            <svg width="13" height="13" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline', verticalAlign: 'middle' }}><path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.832 4.584 2.236 6.393L4 29l7.828-2.236A11.96 11.96 0 0 0 16 27c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 21.5c-1.77 0-3.45-.46-4.91-1.26l-.35-.2-4.65 1.33 1.33-4.65-.2-.35A8.97 8.97 0 0 1 7 15c0-4.963 4.037-9 9-9s9 4.037 9 9-4.037 9-9 9zm5.07-6.36c-.28-.14-1.65-.81-1.9-.9-.25-.09-.43-.14-.61.14-.18.28-.7.9-.86 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.4-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47-.16-.01-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3 0 1.36.98 2.68 1.12 2.87.14.18 1.93 2.95 4.68 4.02.65.28 1.16.45 1.56.58.66.21 1.26.18 1.73.11.53-.08 1.65-.67 1.88-1.32.23-.65.23-1.21.16-1.32-.07-.11-.25-.18-.53-.32z" fill="#25D366"/></svg>
                          </span>
                        </a>
                      ) : (
                        <span>N/A</span>
                      )}
                      {')'}
                    </>
                  )}
                </span>
              </div>
            </div>
            <div style={{ padding: '18px 28px 18px 28px', background: '#fff' }}>
              <button
                onClick={() => toggleOrder(order.id)}
                style={{
                  padding: "7px 18px",
                  cursor: "pointer",
                  borderRadius: "7px",
                  border: "none",
                  background: expandedOrders[order.id] ? "#ede9fe" : "#7c3aed",
                  color: expandedOrders[order.id] ? "#7c3aed" : "#fff",
                  fontWeight: 600,
                  fontSize: 15,
                  marginBottom: 10,
                  transition: 'all 0.2s',
                  boxShadow: expandedOrders[order.id] ? '0 2px 8px #ede9fe' : 'none'
                }}
              >
                {expandedOrders[order.id] ? "Hide Items" : "View Items"}
              </button>

              {expandedOrders[order.id] && order.items?.length > 0 && (
                <ul style={{ marginTop: "10px" }}>
                  {order.items.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{
                            width: "50px",
                            height: "50px",
                            objectFit: "cover",
                            marginRight: "10px",
                            borderRadius: "5px",
                            border: "1px solid #ccc",
                          }}
                        />
                      )}
                      <span>
                        {item.name} – ₦{item.price} x {item.quantity || 1}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p style={{ marginTop: "10px", fontWeight: 600, color: '#7c3aed', fontSize: 16 }}>
                <strong>Total:</strong> ₦{calculateTotal(order.items || [])}
              </p>

              {(order.status || "Pending") === "Pending" && (
                <button
                  onClick={() => cancelOrder(order.id)}
                  style={{
                    marginTop: "10px",
                    padding: "7px 18px",
                    border: "none",
                    borderRadius: "7px",
                    background: "red",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 15
                  }}
                >
                  Cancel Order
                </button>
              )}
              {/* Advisory message for customer follow-up */}
              <div style={{ marginTop: 18, color: '#6366f1', fontSize: '0.98em', fontWeight: 500, textAlign: 'center' }}>
                You are advised to contact both the pharmacy and the delivery agents to follow up on your order.
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
