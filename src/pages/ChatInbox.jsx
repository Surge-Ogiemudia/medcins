import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";

// ChatInbox: Lists all customer chats for the logged-in business
export default function ChatInbox({ businessId }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!businessId) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", businessId));
    const unsub = onSnapshot(q, async (snap) => {
      const chatList = [];
      const customerIds = new Set();
      snap.forEach((doc) => {
        const data = doc.data();
        // Find the other participant (customer)
        const other = data.participants.find((p) => p !== businessId);
        if (other) {
          chatList.push({ id: doc.id, ...data, customerId: other });
          customerIds.add(other);
        }
      });
      setChats(chatList);
      // Fetch customer info for display
      const customerInfo = {};
      await Promise.all(
        Array.from(customerIds).map(async (cid) => {
          const snap = await getDoc(doc(db, "users", cid));
          if (snap.exists()) customerInfo[cid] = snap.data();
        })
      );
      setCustomers(customerInfo);
      setLoading(false);
    });
    return () => unsub();
  }, [businessId]);

  if (loading) return <div>Loading chat inbox...</div>;
  if (chats.length === 0) return <div>No customer chats yet.</div>;

  return (
    <div style={{ background: '#f8f8ff', padding: 20, borderRadius: 12, marginTop: 24 }}>
      <h3 style={{ color: '#6366f1', marginBottom: 16 }}>Customer Chat Inbox</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {chats.map((chat) => {
          const cust = customers[chat.customerId] || {};
          return (
            <li key={chat.id} style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px #e0e0e0' }}>
              <img src={cust.photo || 'https://ui-avatars.com/api/?name=' + (cust.name || cust.email || 'Customer')} alt={cust.name || cust.email || 'Customer'} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{cust.name || cust.email || 'Customer'}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{cust.email}</div>
              </div>
              <button onClick={() => navigate(`/chat/${businessId}`, { state: { customerId: chat.customerId, chatId: chat.id } })} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Open Chat</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
