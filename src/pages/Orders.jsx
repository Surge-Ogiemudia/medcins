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
    acc[status] = orders.filter((o) => (o.status || "Pending") === status);
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
              marginBottom: "20px",
              padding: "15px",
              border: "1px solid #ccc",
              borderRadius: "10px",
              background: "#f9f9f9",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p>
                <strong>Order Date:</strong> {timeAgoOrDate(order.date)}
              </p>
              <button
                onClick={() => toggleOrder(order.id)}
                style={{
                  padding: "5px 10px",
                  cursor: "pointer",
                  borderRadius: "5px",
                  border: "none",
                  background: "#007bff",
                  color: "#fff",
                }}
              >
                {expandedOrders[order.id] ? "Hide Items" : "View Items"}
              </button>
            </div>

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

            <p style={{ marginTop: "10px" }}>
              <strong>Total:</strong> ₦{calculateTotal(order.items || [])}
            </p>

            {(order.status || "Pending") === "Pending" && (
              <button
                onClick={() => cancelOrder(order.id)}
                style={{
                  marginTop: "10px",
                  padding: "5px 10px",
                  border: "none",
                  borderRadius: "5px",
                  background: "red",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel Order
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
