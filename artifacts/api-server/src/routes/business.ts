import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { db, usersTable, productsTable, systemSettingsTable, productOrdersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

// GET /api/business/products - List all active products for the marketplace from registered sellers
router.get("/business/products", async (req, res): Promise<void> => {
  try {
    const activeProducts = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        price: productsTable.price,
        imageUrl: productsTable.imageUrl,
        isActive: productsTable.isActive,
        createdAt: productsTable.createdAt,
        seller: {
          id: usersTable.id,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
          isBusinessVerified: usersTable.isBusinessVerified,
          isSeller: usersTable.isSeller,
          businessName: usersTable.businessName,
          businessDescription: usersTable.businessDescription,
        }
      })
      .from(productsTable)
      .innerJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
      .where(
        and(
          eq(productsTable.isActive, true),
          eq(usersTable.isSeller, true)
        )
      )
      .orderBy(desc(productsTable.createdAt));

    res.json(activeProducts.map(serializeDates));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business/become-seller - Become a seller (accept agreement)
router.post("/business/become-seller", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [updatedUser] = await db
      .update(usersTable)
      .set({
        isSeller: true,
        businessName: user.businessName || `${user.displayName || user.username}'s Shop`,
        updatedAt: new Date()
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    res.json(serializeDates(updatedUser));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/products/seller/:sellerId - Get all active products for a specific seller
router.get("/business/products/seller/:sellerId", async (req, res): Promise<void> => {
  try {
    const sellerId = parseInt(req.params.sellerId, 10);
    if (isNaN(sellerId)) {
      res.status(400).json({ error: "Invalid seller ID" }); return;
    }

    const sellerProducts = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.sellerId, sellerId),
          eq(productsTable.isActive, true)
        )
      )
      .orderBy(desc(productsTable.createdAt));

    res.json(sellerProducts.map(serializeDates));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/my-products - List the logged-in seller's products
router.get("/business/my-products", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const myProducts = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.sellerId, user.id))
      .orderBy(desc(productsTable.createdAt));

    res.json(myProducts.map(serializeDates));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business/products - Create a new product
router.post("/business/products", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const { name, description, price, imageUrl, isActive } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Product name is required" }); return;
    }
    const parsedPrice = parseInt(price, 10);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ error: "Invalid price" }); return;
    }

    const [product] = await db
      .insert(productsTable)
      .values({
        sellerId: user.id,
        name: name.trim(),
        description: description ? description.trim() : null,
        price: parsedPrice,
        imageUrl: imageUrl || null,
        isActive: isActive !== undefined ? !!isActive : true,
      })
      .returning();

    res.status(201).json(serializeDates(product));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/business/products/:id - Edit a product
router.patch("/business/products/:id", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const productId = parseInt(req.params.id, 10);
    const product = await db.query.productsTable.findFirst({
      where: and(eq(productsTable.id, productId), eq(productsTable.sellerId, user.id)),
    });
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    const { name, description, price, imageUrl, isActive } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Product name cannot be empty" }); return;
      }
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description ? description.trim() : null;
    }
    if (price !== undefined) {
      const parsedPrice = parseInt(price, 10);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        res.status(400).json({ error: "Invalid price" }); return;
      }
      updates.price = parsedPrice;
    }
    if (imageUrl !== undefined) {
      updates.imageUrl = imageUrl || null;
    }
    if (isActive !== undefined) {
      updates.isActive = !!isActive;
    }

    const [updatedProduct] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, productId))
      .returning();

    res.json(serializeDates(updatedProduct));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/business/products/:id - Delete a product
router.delete("/business/products/:id", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const productId = parseInt(req.params.id, 10);
    const product = await db.query.productsTable.findFirst({
      where: and(eq(productsTable.id, productId), eq(productsTable.sellerId, user.id)),
    });
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    await db.delete(productsTable).where(eq(productsTable.id, productId));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/business/profile - Update business settings
router.patch("/business/profile", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const { businessName, businessDescription, businessAutoReply, hideOnlineStatus } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (businessName !== undefined) {
      updates.businessName = businessName ? businessName.trim() : null;
    }
    if (businessDescription !== undefined) {
      updates.businessDescription = businessDescription ? businessDescription.trim() : null;
    }
    if (businessAutoReply !== undefined) {
      updates.businessAutoReply = businessAutoReply ? businessAutoReply.trim() : null;
    }
    if (hideOnlineStatus !== undefined) {
      updates.hideOnlineStatus = !!hideOnlineStatus;
    }

    const [updatedUser] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, user.id))
      .returning();

    res.json(serializeDates(updatedUser));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business/verify/:userId - Toggle business verification (Admin Only)
router.post("/business/verify/:userId", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (user.role !== "admin") {
      res.status(403).json({ error: "Only admins can verify businesses" }); return;
    }

    const targetId = parseInt(req.params.userId, 10);
    const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
    if (!target) { res.status(404).json({ error: "Target user not found" }); return; }

    const [updatedTarget] = await db
      .update(usersTable)
      .set({
        isBusinessVerified: !target.isBusinessVerified,
        updatedAt: new Date()
      })
      .where(eq(usersTable.id, targetId))
      .returning();

    res.json(serializeDates(updatedTarget));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business/products/:id/buy - Create a SayaBayar invoice for a product purchase
router.post("/business/products/:id/buy", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const productId = parseInt(req.params.id, 10);
    const product = await db.query.productsTable.findFirst({
      where: eq(productsTable.id, productId),
    });
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    const seller = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, product.sellerId),
    });
    if (!seller) { res.status(404).json({ error: "Seller not found" }); return; }

    // 1. Get SayaBayar configurations
    const settingsRow = await db.query.systemSettingsTable.findFirst({
      where: eq(systemSettingsTable.key, "homepage_settings"),
    });
    const settings = {
      sayabayarApiKey: "",
      ...(settingsRow?.value || {} as any),
    };
    const apiKey = settings.sayabayarApiKey;

    if (!apiKey) {
      res.status(400).json({ error: "SayaBayar API Key belum dikonfigurasi di pengaturan admin." });
      return;
    }

    const sellerName = seller.businessName || seller.displayName || seller.username;
    const description = `${product.name} by ${sellerName}`;
    const email = `${user.username || "user"}_${user.id}_buy@arcadiamc.net`;
    const customerName = user.displayName || user.username || `Player #${user.id}`;
    const origin = req.headers.origin || "http://localhost:5173";
    const redirectUrl = `${origin}/member?tab=messages`;

    // 2. Call SayaBayar API to create invoice
    const apiResponse = await fetch("https://api.sayabayar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        customer_name: customerName,
        customer_email: email,
        amount: product.price,
        description: description,
        channel_preference: "platform",
        redirect_url: redirectUrl,
      }),
    });

    const resJson = await apiResponse.json() as any;

    if (!apiResponse.ok) {
      console.error("SayaBayar Product Purchase API Error:", JSON.stringify(resJson, null, 2));
      res.status(apiResponse.status).json({
        error: resJson?.error?.message || resJson?.message || resJson?.error || "Gagal membuat invoice di SayaBayar.",
      });
      return;
    }

    const invoiceData = resJson.data;
    if (!invoiceData || !invoiceData.payment_url) {
      throw new Error("Missing invoice data or payment_url from SayaBayar.");
    }

    // 3. Create a pending order record in the database
    await db.insert(productOrdersTable).values({
      buyerId: user.id,
      sellerId: product.sellerId,
      productId: product.id,
      invoiceId: invoiceData.id,
      paymentUrl: invoiceData.payment_url,
      price: product.price,
      status: "pending",
    });

    res.json({ checkoutUrl: invoiceData.payment_url });
  } catch (err: any) {
    console.error("Error in product buy route:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/orders - Get incoming orders for the seller
router.get("/business/orders", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const orders = await db
      .select({
        id: productOrdersTable.id,
        price: productOrdersTable.price,
        status: productOrdersTable.status,
        createdAt: productOrdersTable.createdAt,
        invoiceId: productOrdersTable.invoiceId,
        paymentUrl: productOrdersTable.paymentUrl,
        product: {
          id: productsTable.id,
          name: productsTable.name,
          imageUrl: productsTable.imageUrl,
        },
        buyer: {
          id: usersTable.id,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
        }
      })
      .from(productOrdersTable)
      .innerJoin(productsTable, eq(productOrdersTable.productId, productsTable.id))
      .innerJoin(usersTable, eq(productOrdersTable.buyerId, usersTable.id))
      .where(eq(productOrdersTable.sellerId, user.id))
      .orderBy(desc(productOrdersTable.createdAt));

    res.json(orders.map(serializeDates));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business/orders/:id/deliver - Mark order as delivered
router.post("/business/orders/:id/deliver", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const orderId = parseInt(req.params.id, 10);
    const order = await db.query.productOrdersTable.findFirst({
      where: eq(productOrdersTable.id, orderId),
    });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.sellerId !== user.id) { res.status(403).json({ error: "Not authorized" }); return; }

    const [updated] = await db
      .update(productOrdersTable)
      .set({ status: "delivered", updatedAt: new Date() })
      .where(eq(productOrdersTable.id, orderId))
      .returning();

    res.json(serializeDates(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/purchases - Get purchases made by the current user
router.get("/business/purchases", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const purchases = await db
      .select({
        id: productOrdersTable.id,
        productId: productOrdersTable.productId,
        price: productOrdersTable.price,
        status: productOrdersTable.status,
        paymentUrl: productOrdersTable.paymentUrl,
        createdAt: productOrdersTable.createdAt,
        updatedAt: productOrdersTable.updatedAt,
      })
      .from(productOrdersTable)
      .where(eq(productOrdersTable.buyerId, user.id))
      .orderBy(desc(productOrdersTable.createdAt));
    res.json(purchases.map(serializeDates));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business/orders/:id/sync - Sync order status with SayaBayar
router.post("/business/orders/:id/sync", async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getDbUser(auth.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const orderId = parseInt(req.params.id, 10);
    const order = await db.query.productOrdersTable.findFirst({
      where: eq(productOrdersTable.id, orderId),
    });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    // Only the buyer or the seller can sync the order
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      res.status(403).json({ error: "Not authorized" }); return;
    }

    if (order.status !== "pending") {
      res.json(serializeDates(order));
      return;
    }

    // Get SayaBayar API Key
    const settingsRow = await db.query.systemSettingsTable.findFirst({
      where: eq(systemSettingsTable.key, "homepage_settings"),
    });
    const settings = (settingsRow?.value || {}) as any;
    const apiKey = settings.sayabayarApiKey;

    if (!apiKey) {
      res.status(400).json({ error: "SayaBayar API Key belum dikonfigurasi di pengaturan admin." });
      return;
    }

    // Query SayaBayar invoice status
    const apiResponse = await fetch(`https://api.sayabayar.com/v1/invoices/${order.invoiceId}`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
      },
    });

    const resJson = await apiResponse.json() as any;
    if (!apiResponse.ok) {
      console.error("SayaBayar Order Sync API Error:", JSON.stringify(resJson, null, 2));
      res.status(apiResponse.status).json({
        error: resJson?.error?.message || resJson?.message || "Gagal mencocokkan invoice di SayaBayar.",
      });
      return;
    }

    const invoiceData = resJson.data;
    if (invoiceData && invoiceData.status === "paid") {
      const [updated] = await db
        .update(productOrdersTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(productOrdersTable.id, order.id))
        .returning();
      res.json(serializeDates(updated));
    } else {
      res.json(serializeDates(order));
    }
  } catch (err: any) {
    console.error("Error in product order sync:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
