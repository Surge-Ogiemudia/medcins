// src/auth/Auth.jsx
import { useState } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { app, db } from "../firebase";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

const auth = getAuth(app);

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);

  const [isBusinessSignupOpen, setIsBusinessSignupOpen] = useState(false);
  const [isDistributorSignupOpen, setIsDistributorSignupOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [distributorName, setDistributorName] = useState("");
  const [distributorLicense, setDistributorLicense] = useState("");
  const [location, setLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [distributorLocation, setDistributorLocation] = useState(null);
  const [loadingDistributorLocation, setLoadingDistributorLocation] = useState(false);
  // -------- GET DISTRIBUTOR LOCATION --------
  const captureDistributorLocation = async () => {
    if (!navigator.geolocation) {
      alert("❌ Geolocation is not supported by your browser.");
      return null;
    }
    setLoadingDistributorLocation(true);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setDistributorLocation(coords);
          setLoadingDistributorLocation(false);
          resolve(coords);
        },
        (err) => {
          setLoadingDistributorLocation(false);
          alert("⚠️ Location access denied or unavailable.");
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

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
      alert(`✅ Distributor signup successful!\nYour distributor link: medcins.com/store/${slug}`);
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
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = res.user;

      const userData = {
        email: newUser.email,
        role: "customer",
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
      if (!businessName || !licenseNumber) {
        alert("Please provide business name and license number.");
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
        licenseNumber,
        location: coords,
        slug, // ✅ added unique slug
        businessSlug: slug, // ✅ new field for public URL
        createdAt: new Date().toISOString(),
      };

      await writeUserDoc(newUser.uid, userData);
      console.log("Firestore user record created for business:", userData);

      setUser({ ...newUser, ...userData });
      alert(`✅ Business signup successful!\nYour store link: medcins.com/store/${slug}`);

      // reset
      setIsBusinessSignupOpen(false);
      setBusinessName("");
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

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h2>🔐 Authentication</h2>

      {user ? (
        <div>
          <p>
            Welcome, {user.email} {user.role ? `(${user.role})` : ""}
          </p>
          {user.role === "medicine-manager" && (
            <>
              <p>Business: {user.businessName}</p>
              <p>
  🏪 Store link:{" "}
  <a
    href={`/store/${user.businessSlug}`}
    target="_blank"
    rel="noopener noreferrer"
  >
    medcins.com/store/{user.businessSlug}
  </a>
</p>

            </>
          )}
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ margin: "10px", padding: "8px" }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ margin: "10px", padding: "8px" }}
            />
          </div>

          <div>
            <button onClick={signupCustomer} style={{ margin: "5px", padding: "8px 12px" }}>
              Sign Up as Customer
            </button>

            <button
              onClick={() => setIsBusinessSignupOpen((s) => !s)}
              style={{ margin: "5px", padding: "8px 12px" }}
            >
              {isBusinessSignupOpen ? "Close Business Signup" : "Sign Up as Business"}
            </button>

            <button
              onClick={() => setIsDistributorSignupOpen((s) => !s)}
              style={{ margin: "5px", padding: "8px 12px" }}
            >
              {isDistributorSignupOpen ? "Close Distributor Signup" : "Sign Up as Distributor"}
            </button>

            <button onClick={login} style={{ margin: "5px", padding: "8px 12px" }}>
              Login
            </button>
          </div>

          {isBusinessSignupOpen && (
            <div
              style={{
                marginTop: "20px",
                textAlign: "left",
                maxWidth: 480,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <p style={{ marginBottom: 6 }}>Business Signup — provide your details</p>

              <input
                type="text"
                placeholder="Business Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={{ margin: "6px 0", padding: "8px", width: "100%" }}
              />

              <input
                type="text"
                placeholder="License Number"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                style={{ margin: "6px 0", padding: "8px", width: "100%" }}
              />

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={signupBusiness}
                  style={{ padding: "8px 12px" }}
                  disabled={loadingLocation}
                >
                  {loadingLocation ? "Getting Location..." : "Complete Business Signup"}
                </button>
              </div>

              {location && (
                <p style={{ fontSize: "12px", marginTop: "8px" }}>
                  📍 Location captured: {location.latitude.toFixed(5)},{" "}
                  {location.longitude.toFixed(5)}
                </p>
              )}
            </div>
          )}

          {isDistributorSignupOpen && (
            <div
              style={{
                marginTop: "20px",
                textAlign: "left",
                maxWidth: 480,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <p style={{ marginBottom: 6 }}>Distributor Signup — provide your details</p>

              <input
                type="text"
                placeholder="Distributor Name"
                value={distributorName}
                onChange={(e) => setDistributorName(e.target.value)}
                style={{ margin: "6px 0", padding: "8px", width: "100%" }}
              />

              <input
                type="text"
                placeholder="License Number"
                value={distributorLicense}
                onChange={(e) => setDistributorLicense(e.target.value)}
                style={{ margin: "6px 0", padding: "8px", width: "100%" }}
              />

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={signupDistributor}
                  style={{ padding: "8px 12px" }}
                  disabled={loadingDistributorLocation}
                >
                  {loadingDistributorLocation ? "Getting Location..." : "Complete Distributor Signup"}
                </button>
              </div>

              {distributorLocation && (
                <p style={{ fontSize: "12px", marginTop: "8px" }}>
                  📍 Location captured: {distributorLocation.latitude.toFixed(5)}, {distributorLocation.longitude.toFixed(5)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
