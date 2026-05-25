import CarouselBuilderGuidelines from "../../../components/CarouselBuilderGuidelines";

export default function CarouselBuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CarouselBuilderGuidelines />
      {children}
    </>
  );
}
