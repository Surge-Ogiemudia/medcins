  import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where, getDocs
} from "firebase/firestore";
import NIGERIAN_STATES from "../constants/nigerianStates";
  
  export default function Auth() {
    const navigate = useNavigate();
  
    // Define all your state hooks here
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [businessAddress, setBusinessAddress] = useState("");
    const [businessState, setBusinessState] = useState("");
    const [businessCity, setBusinessCity] = useState("");
    const [businessLandmark, setBusinessLandmark] = useState("");
    const [isBusinessSignupOpen, setIsBusinessSignupOpen] = useState(false);
    const [isDistributorSignupOpen, setIsDistributorSignupOpen] = useState(false);
    const [isDeliveryAgentSignupOpen, setIsDeliveryAgentSignupOpen] = useState(false);
    const [deliveryAgentForm, setDeliveryAgentForm] = useState({});
    const [deliveryAgentLoading, setDeliveryAgentLoading] = useState(false);
    const initialDeliveryAgentForm = {}; // Define your initial form state
  

    // Redirect logic moved to useEffect to avoid hook/render errors
    React.useEffect(() => {
      if (user) {
        if (user.role === "delivery-agent" && user.slug) {
          navigate(`/agent/${user.slug}`);
        } else {
          navigate("/");
        }
      }
    }, [user, navigate]);
  
    // ...rest of your code (all the hooks, functions, and return JSX)...

  // -------- DISTRIBUTOR SIGNUP --------
  const signupDistributor = async () => {
    try {
      if (!distributorName || !distributorLicense) {
        alert("Please provide distributor name and license number.");
        return;
      }
      // Capture location before account creation
      const coords = await captureDistributorLocation();
      if (!coords) {
        alert("📍 Location required to complete distributor signup.");
        return;
      }
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = res.user;
      // Generate unique slug
      const slug = await generateUniqueSlug(distributorName);
      const userData = {
        email: newUser.email,
        role: "distributor",
        businessName: distributorName,
        licenseNumber: distributorLicense,
        location: coords,
        slug,
        businessSlug: slug,
        createdAt: new Date().toISOString(),
      };
      await writeUserDoc(newUser.uid, userData);
      setUser({ ...newUser, ...userData });
  alert(`✅ Distributor signup successful!\nYour distributor link: pharmastack.com/store/${slug}`);
      // reset
      setIsDistributorSignupOpen(false);
      setDistributorName("");
      setDistributorLicense("");
      setDistributorLocation(null);
    } catch (err) {
      console.error("Distributor signup error:", err);
      alert(err.message || "Distributor signup failed");
    }
  };

  // -------- Helper: Slugify a business name --------
  const slugify = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "") // remove symbols & spaces
      .replace(/^-+|-+$/g, ""); // remove leading/trailing hyphens
  };

  // -------- Helper: Ensure slug is unique --------
  const generateUniqueSlug = async (baseName) => {
    let slug = slugify(baseName);
    const usersRef = collection(db, "users");
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const q = query(usersRef, where("slug", "==", uniqueSlug));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) break; // slug available
      uniqueSlug = `${slug}${counter++}`;
    }

    return uniqueSlug;
  };

  // helper to write user doc
  const writeUserDoc = async (uid, data) => {
    console.log("Writing user doc for:", uid, data);
    await setDoc(doc(db, "users", uid), data);
  };

  // -------- CUSTOMER SIGNUP --------
  const signupCustomer = async () => {
    try {
      if (!address || !state || !city) {
        alert("Please provide address, state, and city.");
        return;
      }
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = res.user;

      const userData = {
        email: newUser.email,
        role: "customer",
        address: address,
        state: state,
        city: city,
        landmark: landmark,
        createdAt: new Date().toISOString(),
      };

      await writeUserDoc(newUser.uid, userData);
      setUser({ ...newUser, ...userData });
      alert("✅ Customer signup successful!");
    } catch (err) {
      console.error("Customer signup error:", err);
      alert(err.message);
    }
  };

  // -------- GET BUSINESS LOCATION --------
  const captureBusinessLocation = async () => {
    if (!navigator.geolocation) {
      alert("❌ Geolocation is not supported by your browser.");
      return null;
    }

    setLoadingLocation(true);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setLocation(coords);
          setLoadingLocation(false);
          resolve(coords);
        },
        (err) => {
          setLoadingLocation(false);
          alert("⚠️ Location access denied or unavailable.");
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  // -------- BUSINESS SIGNUP --------
  const signupBusiness = async () => {
    try {
      if (!businessName || !licenseNumber || !businessAddress) {
        alert("Please provide business name, address, and license number.");
        return;
      }

      // Capture location before account creation
      const coords = await captureBusinessLocation();
      if (!coords) {
        alert("📍 Location required to complete business signup.");
        return;
      }

      const res = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = res.user;
      console.log("Business user created:", newUser.uid);

      // Generate unique slug
      const slug = await generateUniqueSlug(businessName);
      console.log("Generated unique slug:", slug);

      const userData = {
        email: newUser.email,
        role: "medicine-manager",
        businessName,
        address: businessAddress, // generic field for Admin.jsx
        city: businessCity,
        state: businessState,
        landmark: businessLandmark,
        licenseNumber,
        location: coords,
        lat: coords.latitude,
        lng: coords.longitude,
        slug, // ✅ added unique slug
        businessSlug: slug, // ✅ new field for public URL
        businessPhone,
        businessWhatsapp,
        createdAt: new Date().toISOString(),
      };

      await writeUserDoc(newUser.uid, userData);
      console.log("Firestore user record created for business:", userData);

      setUser({ ...newUser, ...userData });
  alert(`✅ Business signup successful!\nYour store link: pharmastack.com/store/${slug}`);

      // reset
  setIsBusinessSignupOpen(false);
  setBusinessName("");
  setBusinessAddress("");
  setLicenseNumber("");
  setLocation(null);
    } catch (err) {
      console.error("Business signup error:", err);
      alert(err.message || "Business signup failed");
    }
  };

  // -------- LOGIN --------
  const login = async () => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = res.user;

      const docSnap = await getDoc(doc(db, "users", loggedInUser.uid));
      if (docSnap.exists()) {
        setUser({ ...loggedInUser, ...docSnap.data() });
        // If user is a delivery agent, redirect to their slug profile
        if (docSnap.data().role === "delivery-agent" && docSnap.data().slug) {
          navigate(`/agent/${docSnap.data().slug}`);
        }
      } else {
        alert("⚠️ No Firestore user record found. Please contact admin.");
        setUser({ ...loggedInUser });
      }
    } catch (err) {
      console.error("Login error:", err);
      alert(err.message || "Login failed");
    }
  };

  // -------- LOGOUT --------
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // -------- DELIVERY AGENT SIGNUP --------
  const signupDeliveryAgent = async () => {
    try {
      setDeliveryAgentLoading(true);
      // Validate required fields
      const required = [
        "companyName",
        "phoneNumber",
        "whatsappNumber",
        "rcNumber",
        "businessAddress",
        "email",
        "coverageArea",
        "operatingHours",
        "logoUrl",
        "state",
        "city",
      ];
      for (const field of required) {
        if (!deliveryAgentForm[field]) {
          alert(`Please fill the ${field} field.`);
          setDeliveryAgentLoading(false);
          return;
        }
      }
      // Create Auth user
      const res = await createUserWithEmailAndPassword(auth, deliveryAgentForm.email, password);
      const newUser = res.user;
      // Generate unique slug
      const slug = await generateUniqueSlug(deliveryAgentForm.companyName);
      const agentData = {
        ...deliveryAgentForm,
        role: "delivery-agent",
        slug,
        createdAt: new Date().toISOString(),
      };
      await writeUserDoc(newUser.uid, agentData);
      // Also add to deliveryAgents collection for admin management
      const deliveryAgentDoc = {
        companyName: deliveryAgentForm.companyName,
        phoneNumber: deliveryAgentForm.phoneNumber,
        whatsappNumber: deliveryAgentForm.whatsappNumber,
        rcNumber: deliveryAgentForm.rcNumber,
        businessAddress: deliveryAgentForm.businessAddress,
        email: deliveryAgentForm.email,
        coverageArea: deliveryAgentForm.coverageArea,
        operatingHours: deliveryAgentForm.operatingHours,
        logoUrl: deliveryAgentForm.logoUrl,
        state: deliveryAgentForm.state,
        city: deliveryAgentForm.city,
        landmark: deliveryAgentForm.landmark,
        userId: newUser.uid,
        createdAt: new Date().toISOString(),
        slug,
      };
      const { addDoc, collection } = await import("firebase/firestore");
      await addDoc(collection(db, "deliveryAgents"), deliveryAgentDoc);
      setUser({ ...newUser, ...agentData });
      alert("✅ Delivery agent signup successful!");
      // Reset form
      setIsDeliveryAgentSignupOpen(false);
      setDeliveryAgentForm(initialDeliveryAgentForm);
    } catch (err) {
      console.error("Delivery agent signup error:", err);
      alert(err.message || "Delivery agent signup failed");
    } finally {
      setDeliveryAgentLoading(false);
    }
  };

  // Auth page UX state
  const [showSignup, setShowSignup] = useState(false);
  const [signupType, setSignupType] = useState('customer');
  const signupOptions = [
    { key: 'customer', label: 'Customer' },
    { key: 'business', label: 'Business' },
    { key: 'distributor', label: 'Distributor' },
    { key: 'delivery-agent', label: 'Delivery Agent' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #f4f6fb 100%)', fontFamily: 'Inter, Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
  <h2 style={{ fontWeight: 700, color: '#2d3748', marginBottom: 24, letterSpacing: 1, fontSize: 32 }}>🔐 Welcome to Pharmastack</h2>
      {user && (
        <button style={{position:'absolute',top:20,right:20, background:'#e53e3e', color:'#fff', border:'none', borderRadius:6, padding:'8px 18px', fontWeight:600, cursor:'pointer'}} onClick={logout}>Logout</button>
      )}
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, boxShadow: '0 4px 32px #c7d2fe55', padding: 36, marginTop: 8 }}>
        {user ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#2d3748', marginBottom: 8 }}>
              Welcome, {user.email} {user.role ? <span style={{color:'#6366f1'}}>({user.role.replace(/-/g,' ')})</span> : ""}
            </p>
            {user.role === "medicine-manager" && (
              <>
                <p style={{marginBottom:8}}>Business: <b>{user.businessName}</b></p>
                <p style={{fontSize:15}}>
                  🏪 Store link: {" "}
                  <a
                    href={`/store/${user.businessSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#6366f1', textDecoration: 'underline' }}
                  >
                    pharmastack.com/store/{user.businessSlug}
                  </a>
                </p>
              </>
            )}
            {user.role === "delivery-agent" && (
              <>
                <p style={{marginBottom:8}}>Delivery Agent: <b>{user.companyName}</b></p>
                <p style={{fontSize:15}}>Email: {user.email}</p>
              </>
            )}
              </div>
        ) : (
          <>
            {/* Login/Signup switcher */}
            {!showSignup ? (
              <>
                <h3 style={{ color: '#6366f1', fontWeight: 700, marginBottom: 18, fontSize: 20, letterSpacing: 0.5 }}>Login</h3>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ margin: "10px 0", padding: "12px", borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', fontSize: 16 }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ margin: "10px 0", padding: "12px", borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', fontSize: 16 }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button
                    onClick={login}
                    style={{ flex: 1, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setShowSignup(true)}
                    style={{ flex: 1, background: '#2d3748', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
                  >
                    Sign Up
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 18 }}>
                  <select
                    value={signupType}
                    onChange={e => setSignupType(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16 }}
                  >
                    {signupOptions.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {/* Signup forms for each type */}
                {signupType === 'customer' && (
                  <>
                    <h3 style={{ color: '#2563eb', fontWeight: 700, marginBottom: 18, fontSize: 20, letterSpacing: 0.5 }}>Customer Signup</h3>
                    <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="State" value={state} onChange={e => setState(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="City" value={city} onChange={e => setCity(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Nearest Landmark" value={landmark} onChange={e => setLandmark(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ margin: "18px 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ margin: "0 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <div style={{ marginTop: 10 }}>
                      <button onClick={signupCustomer} style={{ padding: "10px 0", background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }} disabled={loadingLocation}>
                        {loadingLocation ? "Getting Location..." : "Complete Customer Signup"}
                      </button>
                      <button onClick={() => setShowSignup(false)} style={{ marginTop: 8, width: '100%', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Back to Login</button>
                    </div>
                    {location && (
                      <p style={{ fontSize: "12px", marginTop: "8px" }}>
                        📍 Location captured: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                      </p>
                    )}
                  </>
                )}
                {signupType === 'business' && (
                  <>
                    <h3 style={{ color: '#059669', fontWeight: 700, marginBottom: 18, fontSize: 20, letterSpacing: 0.5 }}>Business Signup</h3>
                    <input type="text" placeholder="Business Name" value={businessName} onChange={e => setBusinessName(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Business Address" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="License Number" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <select
                      value={businessState}
                      onChange={e => setBusinessState(e.target.value)}
                      style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1', background: '#f9f9f9', fontSize: 16 }}
                    >
                      <option value="">Select State</option>
                      {NIGERIAN_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    <input type="text" placeholder="City" value={businessCity} onChange={e => setBusinessCity(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Nearest Landmark" value={businessLandmark} onChange={e => setBusinessLandmark(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Phone Number" value={businessPhone} onChange={e => setBusinessPhone(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="WhatsApp Number" value={businessWhatsapp} onChange={e => setBusinessWhatsapp(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ margin: "18px 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ margin: "0 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <div style={{ marginTop: 10 }}>
                      <button onClick={signupBusiness} style={{ padding: "10px 0", background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }} disabled={loadingLocation}>
                        {loadingLocation ? "Getting Location..." : "Complete Business Signup"}
                      </button>
                      <button onClick={() => setShowSignup(false)} style={{ marginTop: 8, width: '100%', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Back to Login</button>
                    </div>
                    {location && (
                      <p style={{ fontSize: "12px", marginTop: "8px" }}>
                        📍 Location captured: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                      </p>
                    )}
                  </>
                )}
                {signupType === 'distributor' && (
                  <>
                    <h3 style={{ color: '#d97706', fontWeight: 700, marginBottom: 18, fontSize: 20, letterSpacing: 0.5 }}>Distributor Signup</h3>
                    <input type="text" placeholder="Distributor Name" value={distributorName} onChange={e => setDistributorName(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="License Number" value={distributorLicense} onChange={e => setDistributorLicense(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="State" value={distributorState} onChange={e => setDistributorState(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="City" value={distributorCity} onChange={e => setDistributorCity(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Nearest Landmark" value={distributorLandmark} onChange={e => setDistributorLandmark(e.target.value)} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ margin: "18px 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ margin: "0 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <div style={{ marginTop: 10 }}>
                      <button onClick={signupDistributor} style={{ padding: "10px 0", background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }} disabled={loadingDistributorLocation}>
                        {loadingDistributorLocation ? "Getting Location..." : "Complete Distributor Signup"}
                      </button>
                      <button onClick={() => setShowSignup(false)} style={{ marginTop: 8, width: '100%', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Back to Login</button>
                    </div>
                    {distributorLocation && (
                      <p style={{ fontSize: "12px", marginTop: "8px" }}>
                        📍 Location captured: {distributorLocation.latitude.toFixed(5)}, {distributorLocation.longitude.toFixed(5)}
                      </p>
                    )}
                  </>
                )}
                {signupType === 'delivery-agent' && (
                  <>
                    <h3 style={{ color: '#059669', fontWeight: 700, marginBottom: 18, fontSize: 20, letterSpacing: 0.5 }}>Delivery Agent Signup</h3>
                    <input type="text" placeholder="Company Name" value={deliveryAgentForm.companyName} onChange={e => setDeliveryAgentForm(f => ({ ...f, companyName: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Phone Number" value={deliveryAgentForm.phoneNumber} onChange={e => setDeliveryAgentForm(f => ({ ...f, phoneNumber: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="WhatsApp Phone Number" value={deliveryAgentForm.whatsappNumber} onChange={e => setDeliveryAgentForm(f => ({ ...f, whatsappNumber: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="RC Number" value={deliveryAgentForm.rcNumber} onChange={e => setDeliveryAgentForm(f => ({ ...f, rcNumber: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Business Address" value={deliveryAgentForm.businessAddress} onChange={e => setDeliveryAgentForm(f => ({ ...f, businessAddress: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="State" value={deliveryAgentForm.state} onChange={e => setDeliveryAgentForm(f => ({ ...f, state: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="City" value={deliveryAgentForm.city} onChange={e => setDeliveryAgentForm(f => ({ ...f, city: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Nearest Landmark" value={deliveryAgentForm.landmark} onChange={e => setDeliveryAgentForm(f => ({ ...f, landmark: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Coverage Area" value={deliveryAgentForm.coverageArea} onChange={e => setDeliveryAgentForm(f => ({ ...f, coverageArea: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Operating Hours (e.g. 8am-6pm)" value={deliveryAgentForm.operatingHours} onChange={e => setDeliveryAgentForm(f => ({ ...f, operatingHours: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="text" placeholder="Business Logo Link: Paste logo image URL here" value={deliveryAgentForm.logoUrl} onChange={e => setDeliveryAgentForm(f => ({ ...f, logoUrl: e.target.value }))} style={{ margin: "6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="email" placeholder="Email" value={deliveryAgentForm.email} onChange={e => setDeliveryAgentForm(f => ({ ...f, email: e.target.value }))} style={{ margin: "18px 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ margin: "0 0 6px 0", padding: "10px", width: "100%", borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <div style={{ marginTop: 10 }}>
                      <button onClick={signupDeliveryAgent} style={{ padding: "10px 0", background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }} disabled={deliveryAgentLoading}>
                        {deliveryAgentLoading ? "Signing Up..." : "Complete Delivery Agent Signup"}
                      </button>
                      <button onClick={() => setShowSignup(false)} style={{ marginTop: 8, width: '100%', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Back to Login</button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
