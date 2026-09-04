import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
// import Home from "./pages/Dashboard/Home";
import Index_Category from "./pages/Category/Index_Category";
import Index_Product from "./pages/Product/Index_Product";
import CreateProduct from "./pages/Product/CreateProduct";
import EditProduct from "./pages/Product/EditProduct";
import Index_Order from "./pages/Order/Index_Order";
import CreateOrder from "./pages/Order/CreateOrder";
import Index_Sale from "./pages/Sale/Index_Sale";
import Dashboard from "./pages/Dashboard/Dashboard";
import Index_Expenses from "./pages/Expenses/Index_Expenses";
import TeamManagement from "./pages/Team/TeamManagement";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="*" element={<Dashboard />} />

            {/* Dashboard Page  */}
            {/* <Route path="/home" element={<Home />} /> */}
            <Route path="/Dashboard" element={<Dashboard />} />

            {/* Category Page */}
            <Route path="/category" element={<Index_Category />} />

            {/* Sale Page */}
            <Route path="/sale" element={<Index_Sale />} />

            {/* Order Page */}
            <Route path="/order" element={<Index_Order />} />
            <Route path="/order/create" element={<CreateOrder />} />

            {/* Expenses Page */}
            <Route path="/expenses" element={<Index_Expenses />} />

            {/* Product Page */}
            <Route path="/product" element={<Index_Product />} />
            <Route path="/product/create" element={<CreateProduct />} />
            <Route path="/product/edit/:id" element={<EditProduct />} />

            {/* Others Page */}
            <Route path="/team" element={<TeamManagement />} />
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="/basic-tables" element={<BasicTables />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
