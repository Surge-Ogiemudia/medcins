import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth <= 600;
}

export default function StoreDirectory() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchStores() {
      const querySnapshot = await getDocs(collection(db, "users"));
      const storeList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === "medicine-manager" && data.businessName && data.slug) {
          storeList.push({
            id: doc.id,
            name: data.businessName,
            slug: data.slug,
            image: data.businessImage || null,
            address: data.businessAddress || "",
            phone: data.businessPhone || "",
          });
        }
      });
      setStores(storeList);
      setLoading(false);
    }
    fetchStores();
  }, []);

  if (loading) return <div style={{textAlign:'center',marginTop:40}}>Loading stores...</div>;

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f4f6fb 0%, #e0e7ff 100%)',
      padding: isMobile() ? '10px 2vw' : '30px',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24, fontSize: isMobile() ? 22 : 32, fontWeight: 800, color: '#2d3748' }}>All Stores</h2>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <input
          type="text"
          placeholder="Search by pharmacy name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            fontSize: isMobile() ? 15 : 16,
            width: isMobile() ? '98vw' : 320,
            maxWidth: '90%',
            outline: 'none',
            boxShadow: '0 1px 4px #ede9fe',
            margin: '0 auto',
            padding: isMobile() ? '8px' : '12px 18px',
            borderRadius: 8,
            border: '1px solid #e0e7ff',
          }}
        />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile() ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))",
        gap: isMobile() ? 14 : 32,
      }}>
        {filteredStores.map(store => (
          <Link key={store.id} to={`/store/${store.slug}`} style={{
            textDecoration: 'none',
            color: '#222',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px #ede9fe',
            padding: isMobile() ? 12 : 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'box-shadow 0.2s',
            border: '1px solid #f3f3f3',
            minHeight: isMobile() ? 120 : 220,
          }}>
            {store.image ? (
              <img src={store.image} alt={store.name} style={{ width: isMobile() ? 50 : 80, height: isMobile() ? 50 : 80, objectFit: 'cover', borderRadius: 12, marginBottom: isMobile() ? 8 : 16, border: '1px solid #e0e7ff' }} />
            ) : (
              <div style={{ width: isMobile() ? 50 : 80, height: isMobile() ? 50 : 80, background: '#ede9fe', borderRadius: 12, marginBottom: isMobile() ? 8 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile() ? 18 : 32, color: '#7c3aed' }}>🏪</div>
            )}
            <div style={{ fontWeight: 600, fontSize: isMobile() ? 16 : 20, marginBottom: 8 }}>{store.name}</div>
            <div style={{ fontSize: isMobile() ? 12 : 15, color: '#6366f1', marginBottom: 6 }}>{store.address}</div>
            <div style={{ fontSize: isMobile() ? 10 : 14, color: '#64748b' }}>{store.phone}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
