import { HelmetProvider, Helmet } from "react-helmet-async";

const PageMeta = ({
  title: _title, // keeping these props to avoid breaking existing implementations
  description: _description,
}: {
  title: string;
  description: string;
}) => (
  <Helmet>
    <title>AP-Strock</title>
    <meta name="description" content="AP-Strock Management System" />
  </Helmet>
);

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>{children}</HelmetProvider>
);

export default PageMeta;
