import CatalogExperience from "../../components/CatalogExperience";
import CatalogMenuAdjustments from "../../components/CatalogMenuAdjustments";
import CatalogPdfDownloadCard from "../../components/CatalogPdfDownloadCard";

export default function CatalogPage() {
  return (
    <>
      <CatalogMenuAdjustments />
      <CatalogExperience />
      <CatalogPdfDownloadCard />
    </>
  );
}
