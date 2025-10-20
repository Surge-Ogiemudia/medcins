import { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export default function FirestoreTest() {
  const [drugs, setDrugs] = useState([]);
  const [newDrug, setNewDrug] = useState("");

  const addDrug = async () => {
    if (!newDrug) return;
    await addDoc(collection(db, "drugs"), { name: newDrug });
    setNewDrug("");
    fetchDrugs();
  };

  const fetchDrugs = async () => {
    const querySnapshot = await getDocs(collection(db, "drugs"));
    const items = querySnapshot.docs.map((doc) => doc.data());
    setDrugs(items);
  };

  useEffect(() => {
    fetchDrugs();
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h2>💊 Firebase Firestore Test</h2>
      <input
        type="text"
        value={newDrug}
        onChange={(e) => setNewDrug(e.target.value)}
        placeholder="Enter drug name"
      />
      <button onClick={addDrug}>Add</button>
      <ul>
        {drugs.map((d, i) => (
          <li key={i}>{d.name}</li>
        ))}
      </ul>
    </div>
  );
}
