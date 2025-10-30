import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, addDoc, serverTimestamp, onSnapshot, doc, setDoc, getDoc, getDocs } from "firebase/firestore";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { uploadImageOrBase64 } from "../utils/imageUpload";


// Chat between customer and business (pharmacy), showing pharmacist info from business profile
export default function Chat() {
  const { businessId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pharmacist, setPharmacist] = useState(location.state?.pharmacist || null);
  const [businessName, setBusinessName] = useState(location.state?.businessName || "Pharmacy");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);

  // Require authentication
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        navigate("/auth");
      } else {
        setUser(u);
      }
    });
    return () => unsub();
  }, [navigate]);

  // Fetch pharmacist info from business doc if not in location.state
  useEffect(() => {
    if (pharmacist && businessName) return;
    if (!businessId) return;
    getDoc(doc(db, "users", businessId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPharmacist(data.pharmacist || null);
        setBusinessName(data.businessName || "Pharmacy");
      }
    });
  }, [businessId, pharmacist, businessName]);

  // Find or create chat session between user and business
  useEffect(() => {
    if (!user || !businessId) return;
    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef,
      where("participants", "array-contains", user.uid)
    );
    // Find chat with both user and business
    getDocs(q).then((snap) => {
      let found = null;
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants.includes(businessId)) {
          found = docSnap.id;
        }
      });
      if (found) {
        setChatId(found);
      } else {
        // Create new chat
        addDoc(chatsRef, {
          participants: [user.uid, businessId],
          createdAt: serverTimestamp(),
        }).then((docRef) => setChatId(docRef.id));
      }
    });
  }, [user, businessId]);

  // Listen for messages in this chat
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [chatId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send a message (text or image)
  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !imageFile) || !user || !chatId) return;
    let imageUrl = null;
    let isBase64 = false;
    if (imageFile) {
      setUploading(true);
      try {
        const { url, isBase64: base64 } = await uploadImageOrBase64(imageFile);
        imageUrl = url;
        isBase64 = base64;
      } catch (err) {
        alert("Image upload failed");
      }
      setUploading(false);
    }
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: input,
      image: imageUrl || null,
      isBase64: isBase64,
      sender: user.uid,
      senderName: user.displayName || user.email,
      timestamp: serverTimestamp(),
    });
    setInput("");
    setImageFile(null);
    setImagePreview(null);
  };

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  if (!user) return null;
  return (
    <div style={{ maxWidth: 500, margin: "40px auto", background: "#fff", borderRadius: 12, boxShadow: "0 2px 16px #c7d2fe33", padding: 24, minHeight: 400, display: "flex", flexDirection: "column" }}>
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12, color: "#6366f1", display: 'flex', alignItems: 'center', gap: 10 }}>
        {pharmacist?.photo && (
          <img src={pharmacist.photo} alt={pharmacist.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
        )}
        Chat with {pharmacist?.name || "Pharmacist"} <span style={{ color: '#888', fontWeight: 400, fontSize: 15 }}>({businessName})</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 16, background: "#f4f6fb", borderRadius: 8, padding: 12, minHeight: 200 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 10, textAlign: msg.sender === user?.uid ? "right" : "left" }}>
            {msg.image && (
              <div style={{ marginBottom: 4 }}>
                <img src={msg.image} alt="chat-img" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 10, border: '1px solid #ddd' }} />
              </div>
            )}
            {msg.text && (
              <span style={{ background: msg.sender === user?.uid ? "#6366f1" : "#e0e7ff", color: msg.sender === user?.uid ? "#fff" : "#222", padding: "8px 14px", borderRadius: 16, display: "inline-block", maxWidth: 320, wordBreak: "break-word" }}>
                {msg.text}
              </span>
            )}
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{msg.senderName}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        <label style={{ cursor: 'pointer', margin: 0 }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
          <span style={{ fontSize: 22, color: '#6366f1', padding: '0 8px' }}>📷</span>
        </label>
        {imagePreview && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={imagePreview} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc' }} />
            <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: 'absolute', top: -8, right: -8, background: '#fff', border: '1px solid #ccc', borderRadius: '50%', width: 18, height: 18, fontSize: 12, cursor: 'pointer', lineHeight: '16px', padding: 0 }}>×</button>
          </div>
        )}
        <button type="submit" style={{ background: uploading ? '#bbb' : "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: uploading ? 'not-allowed' : "pointer" }} disabled={uploading}>
          {uploading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
