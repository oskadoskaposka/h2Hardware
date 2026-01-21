export type Product = {
  slug: string;
  name: string;
  /**
   * Product category (English). Example: "Sliding", "Tilting", "Swing".
   */
  category: "Tilting" | "Sliding" | "Swing";
  model: string;
  price: number;
  regularDiscount: number;
  description: string;
};

export const products: Product[] = [
  {
    slug: "deslizante-linea",
    name: "Sliding Gate Linea",
    category: "Sliding",
    model: "LINEA-01",
    price: 2890,
    regularDiscount: 0.12,
    description:
      "Reinforced structure with premium finish, ideal for homes and businesses.",
  },
  {
    slug: "basculante-urban",
    name: "Tilting Gate Urban",
    category: "Tilting",
    model: "URB-02",
    price: 3190,
    regularDiscount: 0.1,
    description:
      "Modern design, lightweight and functional, with excellent value.",
  },
  {
    slug: "pivotante-prime",
    name: "Swing Gate Prime",
    category: "Swing",
    model: "PRM-03",
    price: 3990,
    regularDiscount: 0.15,
    description:
      "Two leaves, striking presence and custom fit.",
  },
  {
    slug: "deslizante-industrial",
    name: "Sliding Gate Industrial",
    category: "Sliding",
    model: "IND-04",
    price: 4590,
    regularDiscount: 0.18,
    description:
      "High resistance for heavy-duty use and large spans.",
  },
];
