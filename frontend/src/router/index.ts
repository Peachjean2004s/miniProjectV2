import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import homeView from "@/view/homeView.vue";
import chooseRoleView from "@/view/register/chooseRole.vue";
import RegisterOrchard from "@/view/register/registerOrchard.vue";
import RegisterPackingHouse from "@/view/register/registerPackinghouse.vue";
import RegisterTransporter from "@/view/register/registertransporter.vue";
import RegisterRetailer from "@/view/register/registerRetailer.vue";
import OrchardView from "@/view/orchardView.vue";
import PackingHouseView from "@/view/packingHouseView.vue";
import TransporterView from "@/view/transporterView.vue";
import RetailerView from "@/view/retailerView.vue";
import TrackView from "@/view/trackView.vue";

const requireWallet = (_to: any, _from: any, next: any) => {
  const address = localStorage.getItem("walletAddress")
  if (!address) next({ name: "Home" })
  else next()
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: homeView
  },
  {
    path: "/choose-role",
    name: "ChooseRole",
    component: chooseRoleView,
    beforeEnter: requireWallet
  },
  {
    path: "/register/orchard",
    name: "RegisterOrchard",
    component: RegisterOrchard,
    beforeEnter: requireWallet
  },
  {
    path: "/register/packing-house",
    name: "RegisterPackingHouse",
    component: RegisterPackingHouse,
    beforeEnter: requireWallet
  },
  {
    path: "/register/transporter",
    name: "RegisterTransporter",
    component: RegisterTransporter,
    beforeEnter: requireWallet
  },
  {
    path: "/register/retailer",
    name: "RegisterRetailer",
    component: RegisterRetailer,
    beforeEnter: requireWallet
  },
  {
    path: "/orchard",
    name: "OrchardView",
    component: OrchardView,
    beforeEnter: requireWallet
  },
  {
    path: "/packing-house",
    name: "PackingHouseView",
    component: PackingHouseView,
    beforeEnter: requireWallet
  },
  {
    path: "/transporter",
    name: "TransporterView",
    component: TransporterView,
    beforeEnter: requireWallet
  },
  {
    path: "/retailer",
    name: "RetailerView",
    component: RetailerView,
    beforeEnter: requireWallet
  },
  {
    path: "/track/:lotId",
    name: "TrackView",
    component: TrackView,
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;