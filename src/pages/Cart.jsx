import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Cart() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);

  // Watch auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadCart(u.uid);
    });
    return unsubscribe;
  }, [auth]);

  // Load cart from Firestore
  const loadCart = async (uid) => {
    try {
      const docRef = doc(db, "carts", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setCart(docSnap.data().items || []);
      else setCart([]);
    } catch (err) {
      console.error("Error loading cart:", err);
    }
  };

  // Save cart to Firestore
  const saveCart = async (uid, updatedCart) => {
    try {
      await setDoc(doc(db, "carts", uid), { items: updatedCart });
    } catch (err) {
      console.error("Error saving cart:", err);
    }
  };

  // Update total whenever cart changes
  useEffect(() => {
    const sum = cart.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
    setTotal(sum);
  }, [cart]);

  // Add item to cart
  const addToCart = (item) => {
    if (!user) return alert("Please login first");

    const newCart = [...cart];
    const index = newCart.findIndex((i) => i.name === item.name);
    if (index >= 0) newCart[index].quantity += 1;
    else newCart.push({ ...item, quantity: 1 });

    setCart(newCart);
    saveCart(user.uid, newCart);
  };

  // Remove item from cart
  const removeFromCart = (itemName) => {
    if (!user) return alert("Please login first");

    const newCart = [...cart];
    const index = newCart.findIndex((i) => i.name === itemName);
    if (index >= 0) {
      if (newCart[index].quantity > 1) newCart[index].quantity -= 1;
      else newCart.splice(index, 1);
    }

    setCart(newCart);
    saveCart(user.uid, newCart);
  };

  // Navigate to Payment page
  const goToPayment = () => {
    if (!user) return alert("Please login to proceed to payment");
    if (cart.length === 0) return alert("Cart is empty");
    navigate("/payment", { state: { cart, total } });
  };

  return (
    <div style={{ padding: "30px" }}>
      <h2>🛒 Your Cart</h2>
      {user ? <p>Logged in as: {user.email}</p> : <p>Please log in.</p>}

      {cart.length === 0 ? (
        <p>No items in cart.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {cart.map((item, i) => (
            <li
              key={i}
              style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: "10px" }}
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "5px" }}
                />
              )}
              <div>
                <strong>{item.name}</strong> – ₦{item.price} x {item.quantity}
              </div>
              <div>
                <button onClick={() => addToCart(item)} style={{ marginLeft: "10px" }}>
                  +
                </button>
                <button onClick={() => removeFromCart(item.name)} style={{ marginLeft: "5px" }}>
                  -
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Total: ₦{total}</h3>
      <button onClick={goToPayment} style={{ marginTop: "20px" }}>
        Checkout
      </button>
    </div>
  );
}
