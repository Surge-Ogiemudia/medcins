# Meds-Easy Application Blueprint

## Overview

Meds-Easy is a web application designed to help users find and purchase medicines from various pharmacies. It provides a platform for pharmacy owners to manage their inventory and for customers to browse, search, and buy medicines. The application includes features like user authentication, role-based access control, product management, a shopping cart, and a checkout process with online payments.

## Implemented Features & Design

### Core Functionality

*   **User Authentication:** Users can sign up, log in, and log out. Authentication is handled by Firebase Auth.
*   **Role-Based Access Control:**
    *   **Admin:** Has full access to the application, including managing users, medicines, and batches.
    *   **Medicine Manager:** Can add, edit, and delete their own medicines and view their uploaded batches.
    *   **Customer:** Can browse and purchase medicines.
    *   **Orders Only:** Can only view orders (functionality to be fully implemented).
*   **Product Management:**
    *   Medicine managers can add medicines individually or via bulk CSV upload.
    *   Medicines are stored in a "products" collection in Firestore.
    *   CSV uploads are tracked in a "batches" collection.
*   **Shopping & Cart:**
    *   Users can browse a central shop page or view a specific pharmacy's shop.
    *   A powerful search functionality allows users to find medicines by name, ingredient, class, or common synonyms.
    *   Users can add items to a persistent shopping cart stored in Firestore.
*   **Geolocation:** The shop page can use the user's location to estimate the distance and driving time to a pharmacy.
*   **Checkout & Payments:**
    *   Users can enter their delivery information.
    *   The application integrates with Paystack for processing payments.
    *   Successful orders are saved to an "orders" collection in Firestore.

### Pages & Components

*   **`App.jsx`**: The main application component that sets up routing.
*   **`/auth` (`Auth.jsx`):** Handles user sign-up and login.
*   **`/` (`Shop.jsx`):** The main shop page that displays all available medicines. It includes search and filtering capabilities.
*   **`/shop/:slug` (`Shop.jsx`):** A variation of the shop page that displays medicines from a single, specific pharmacy.
*   **`/cart` (`Cart.jsx`):** Displays the user's shopping cart, allowing them to adjust quantities or remove items.
*   **`/payment` (`payment.jsx`):** The checkout page where users provide delivery details and complete their purchase via Paystack.
*   **`/add-medicine` (`AddMedicine.jsx`):** A dashboard for "medicine-manager" roles to add, edit, and manage their medicines.
*   **`/admin` (`Admin.jsx`):** A dashboard for "admin" roles to manage all medicines, batches, and user roles.
*   **`/orders` (`Orders.jsx`):** A page for users to view their order history.
*   **`/business-profile` (`BusinessProfile.jsx`):** A page for medicine managers to update their business information, including their business name, location, and a unique URL slug.
*   **`Header.jsx`:** The main navigation component, showing different links based on the user's authentication status and role.

### Styling & Design

*   The application uses a clean and simple design, with a focus on usability.
*   Styling is primarily done using inline styles within the React components.
*   The layout is responsive and should work well on both desktop and mobile devices.
*   Interactive elements like buttons and inputs have clear states (hover, focus, disabled).

## Current Task: Payment Gateway Integration

### Plan

1.  **[Done]** Install the `react-paystack` library to facilitate the integration.
2.  **[Done]** Create a payment page (`payment.jsx`) where users can review their order and enter delivery details.
3.  **[Done]** Add a "Pay Now" button that triggers the Paystack payment modal.
4.  **[In Progress]** Configure the Paystack integration with a public key.
5.  **[Todo]** Upon successful payment, create an order document in Firestore and clear the user's cart.
6.  **[Todo]** Handle payment cancellation and potential errors gracefully.
