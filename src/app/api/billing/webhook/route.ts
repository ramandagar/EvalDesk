import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions, plans, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isStripeConfigured } from "@/lib/billing";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ received: true });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: any;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

    if (sig && process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(body);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerEmail = session.customer_email;

        if (userId && session.subscription) {
          // Find or create subscription
          const existingSubs = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

          // Get the plan from the line items price id
          const lineItems = session.line_items?.data || [];
          const priceId = lineItems[0]?.price?.id;
          const [plan] = priceId
            ? await db.select().from(plans).where(eq(plans.stripePriceId, priceId)).limit(1)
            : [];

          if (existingSubs.length > 0) {
            await db.update(subscriptions)
              .set({
                planId: plan?.id || existingSubs[0].planId,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                status: "active",
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.userId, userId));
          } else {
            await db.insert(subscriptions).values({
              userId,
              planId: plan?.id || "plan-free",
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              status: "active",
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        if (sub.id) {
          await db.update(subscriptions)
            .set({
              status: sub.status,
              cancelAtPeriodEnd: !!sub.cancel_at_period_end,
              currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        if (sub.id) {
          await db.update(subscriptions)
            .set({ status: "canceled", updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook error:", error.message);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 400 });
  }
}
