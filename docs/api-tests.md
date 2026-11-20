# WedPlan Backend API Test Guide

This test suite covers all core security rules, role verifications, ownership checks, business logic limits, and idempotency guarantees for the WedPlan Express + TypeScript backend.

---

## 1. Authentication & Token Setup

### 1.1 Sign in and retrieve JWT Tokens

#### Customer Token
```bash
curl -s -X POST http://localhost:5001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"fakeadmin@wedplan.com","password":"Password123"}' \
  -c /tmp/cust_cookies.txt > /dev/null

CUSTOMER_TOKEN=$(curl -s http://localhost:5001/api/auth/token -b /tmp/cust_cookies.txt | jq -r '.token')
```

#### Vendor Token
```bash
curl -s -X POST http://localhost:5001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"vendor1@wedplan.com","password":"Password123"}' \
  -c /tmp/vend_cookies.txt > /dev/null

VENDOR_TOKEN=$(curl -s http://localhost:5001/api/auth/token -b /tmp/vend_cookies.txt | jq -r '.token')
```

#### Admin Token
```bash
curl -s -X POST http://localhost:5001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"admin@wedplan.com","password":"Change_this_secure_admin_password_123"}' \
  -c /tmp/admin_cookies.txt > /dev/null

ADMIN_TOKEN=$(curl -s http://localhost:5001/api/auth/token -b /tmp/admin_cookies.txt | jq -r '.token')
```

---

## 2. Authentication Enforcement (401 Unauthorized)

### 2.1 Request with Missing Authorization Header
```bash
curl -i -X GET http://localhost:5001/api/me
```
*Expected Status*: `401 Unauthorized`
```json
{
  "success": false,
  "message": "Unauthorized: Missing or invalid authorization header"
}
```

### 2.2 Request with Invalid / Malformed Bearer Token
```bash
curl -i -X GET http://localhost:5001/api/me \
  -H "Authorization: Bearer invalid_or_expired_jwt_token"
```
*Expected Status*: `401 Unauthorized`
```json
{
  "success": false,
  "message": "Unauthorized: Invalid or expired token"
}
```

---

## 3. Role-Based Access Control (403 Forbidden)

### 3.1 Customer Accessing Vendor-Only Endpoint
```bash
curl -i -X GET http://localhost:5001/api/vendor/services \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Forbidden: Access is denied"
}
```

### 3.2 Vendor Accessing Admin-Only Endpoint
```bash
curl -i -X GET http://localhost:5001/api/admin/overview \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Forbidden: Access is denied"
}
```

### 3.3 Vendor Accessing Customer-Only Booking Endpoint
```bash
curl -i -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -d '{
    "serviceId": "6b000feef37e578827922f7a",
    "eventDate": "2027-01-01T12:00:00.000Z",
    "eventLocation": "Venue",
    "message": "Attempt"
  }'
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Forbidden: Access is denied"
}
```

### 3.4 Blocked User Account Access
When an admin blocks a user via `PATCH /api/admin/users/:id/block`:
```bash
curl -i -X GET http://localhost:5001/api/me \
  -H "Authorization: Bearer $BLOCKED_USER_TOKEN"
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Your account has been blocked"
}
```

---

## 4. Resource Ownership Enforcement

### 4.1 Vendor Updating Another Vendor's Service
```bash
curl -i -X PUT http://localhost:5001/api/vendor/services/<OTHER_VENDOR_SERVICE_ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -d '{"serviceName":"Hijacked Service"}'
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Forbidden: You do not own this service"
}
```

### 4.2 Vendor Deleting Another Vendor's Service
```bash
curl -i -X DELETE http://localhost:5001/api/vendor/services/<OTHER_VENDOR_SERVICE_ID> \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Forbidden: You do not own this service"
}
```

### 4.3 Customer Cancelling Another Customer's Booking
```bash
curl -i -X PATCH http://localhost:5001/api/customer/bookings/<OTHER_CUSTOMER_BOOKING_ID>/cancel \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```
*Expected Status*: `404 Resource not found`

### 4.4 Vendor Viewing Only Own Transactions
```bash
curl -i -X GET http://localhost:5001/api/vendor/transactions \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```
*Expected*: Returns only transactions where `vendorId` or `userId` matches the logged-in vendor's ID.

---

## 5. Duplicate Booking Prevention (409 Conflict)

### 5.1 Create Initial Booking
```bash
curl -i -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{
    "serviceId": "<APPROVED_ACTIVE_SERVICE_ID>",
    "eventDate": "2027-06-15T10:00:00.000Z",
    "eventLocation": "Grand Ballroom, NY",
    "message": "Wedding booking request"
  }'
```
*Expected Status*: `201 Created`

### 5.2 Attempt Duplicate Active Booking on Same Date
```bash
curl -i -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{
    "serviceId": "<APPROVED_ACTIVE_SERVICE_ID>",
    "eventDate": "2027-06-15T10:00:00.000Z",
    "eventLocation": "Grand Ballroom, NY",
    "message": "Duplicate booking attempt"
  }'
```
*Expected Status*: `409 Conflict`
```json
{
  "success": false,
  "message": "You already have an active booking (pending or accepted) for this service on this date"
}
```

---

## 6. Vendor Free-Plan Limit Enforcement

### 6.1 Creating Service Beyond 3 Active Services on Free Plan
When a vendor has `subscriptionPlan: 'free'` and already has 3 services with `isActive: true` and `status in ('pending', 'approved')`:
```bash
curl -i -X POST http://localhost:5001/api/vendor/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -d '{
    "serviceName": "Fourth Photography Service",
    "category": "Photography & Videography",
    "description": "Attempting fourth active service on free plan.",
    "price": 1000,
    "location": "New York, NY",
    "images": ["https://images.unsplash.com/photo-1519741497674-611481863552"]
  }'
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Free plan limit reached. You can only have up to 3 active services. Please upgrade to Premium for unlimited services."
}
```

### 6.2 Reactivating Service Beyond Limit
```bash
curl -i -X PATCH http://localhost:5001/api/vendor/services/<INACTIVE_SERVICE_ID>/availability \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -d '{"isActive": true}'
```
*Expected Status*: `403 Forbidden`
```json
{
  "success": false,
  "message": "Free plan limit reached. You can only have up to 3 active services. Please upgrade to Premium to activate more services."
}
```

---

## 7. Profile Updates & Strict Schema Validation

### 7.1 Rejection of Restricted / Escalation Fields (400 Bad Request)
```bash
curl -i -X PATCH http://localhost:5001/api/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"role": "admin"}'
```
*Expected Status*: `400 Bad Request`
```json
{
  "success": false,
  "message": "Cannot update restricted or unrecognized fields: role"
}
```

### 7.2 Non-Vendor Setting Business Name (400 Bad Request)
```bash
curl -i -X PATCH http://localhost:5001/api/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"businessName": "Customer Business"}'
```
*Expected Status*: `400 Bad Request`
```json
{
  "success": false,
  "message": "Only vendors can update businessName"
}
```

---

## 8. Stripe Webhook Idempotency & Security

### 8.1 Missing Stripe Signature
```bash
curl -i -X POST http://localhost:5001/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_test"}'
```
*Expected Status*: `400 Bad Request`
```json
{
  "success": false,
  "message": "Missing stripe-signature header"
}
```

### 8.2 Webhook Event Idempotency
When Stripe resends an identical event payload with matching `stripeSessionId` or `event.id`:
1. First delivery creates the transaction and updates vendor subscription to `'premium'`.
2. Second delivery responds `200 { "received": true }` immediately without duplicating transaction rows in MongoDB.

---

## 9. Error Handling in Production

When `NODE_ENV=production`:
- Unhandled 500 errors always return `{ "success": false, "message": "Internal Server Error" }`.
- Stack traces and internal server error details are never exposed to clients.
