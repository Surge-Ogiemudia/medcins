import { useParams } from "react-router-dom";
import Cart from "./Cart";

export default function StoreCart() {
  const { slug } = useParams();
  // You can pass slug to Cart if you want to filter items by store
  return (
    <div>
      <h2>Cart for {slug ? slug : "this store"}</h2>
      <Cart storeSlug={slug} />
    </div>
  );
}
