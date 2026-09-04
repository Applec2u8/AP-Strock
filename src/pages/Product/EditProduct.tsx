import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useDropzone } from "react-dropzone";
import Button from "../../components/ui/button/Button";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../context/UserContext";

interface Category {
    id: number;
    name: string;
}

export default function EditProduct() {
    const user = useUser().user;

    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [error, setError] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState("");

    const [formData, setFormData] = useState({
        pro_img: "",
        pro_name: "",
        sku: "",
        quantity: "",
        qty_stock: "0",
        qty_sale: "0",
        cost_price: "0",
        sell_price: "",
        cate_id: "",
        user_id: "",
    });

    // Sync user_id when user context loads
    useEffect(() => {
        if (user?.id) {
            setFormData(prev => ({ ...prev, user_id: user.id!.toString() }));
        }
    }, [user?.id]);

    useEffect(() => {
        fetchCategories();
        if (id) {
            fetchProduct(parseInt(id));
        }
    }, [id]);


    // generate preview whenever file changes
    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreview(url);
            // revoke url on cleanup
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const fetchCategories = async () => {
        try {
            const { data, error: err } = await supabase
                .from("Category")
                .select("id, name");

            if (err) throw err;
            setCategories(data || []);
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    };

    const fetchProduct = async (productId: number) => {
        try {
            setFetching(true);
            const { data, error: err } = await supabase
                .from("Product")
                .select("*")
                .eq("id", productId)
                .single();

            if (err) throw err;

            if (data) {
                setFormData({
                    pro_img: data.pro_img || "",
                    pro_name: data.pro_name,
                    sku: data.sku,
                    quantity: data.quantity?.toString() || "",
                    qty_stock: data.qty_stock?.toString() || "",
                    qty_sale: data.qty_sale?.toString() || "",
                    cost_price: data.cost_price?.toString() || "0",
                    sell_price: data.sell_price?.toString() || "",
                    cate_id: data.cate_id?.toString() || "",
                    user_id: data.user_id?.toString() || "",
                });
                setPreview(data.pro_img || "");
            }
        } catch (err) {
            console.error("Error fetching product:", err);
            setError("ບໍ່ສາມາດໂຫຼດສິນຄ້າ");
        } finally {
            setFetching(false);
        }
    };

    const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // if user has chosen 'new' category option
        if (name === "cate_id" && value === "new") {
            const newName = window.prompt("ເພີ່ມປະເພດໃໝ່ລາຍການ:");
            if (newName && newName.trim() !== "") {
                try {
                    const { data, error: insertErr } = await supabase
                        .from("Category")
                        .insert([{ name: newName.trim(), user_id: user?.id ?? null }])
                        .select("id, name")
                        .single();
                    if (insertErr) throw insertErr;
                    // refresh categories and select the new one
                    await fetchCategories();
                    setFormData(prev => ({
                        ...prev,
                        cate_id: data?.id.toString() || ""
                    }));
                } catch (err) {
                    console.error("Error creating category:", err);
                    setError("ບໍ່ສາມາດເພີ່ມປະເພດໃໝ່");
                }
            }
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles && acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/png": [],
            "image/jpeg": [],
            "image/webp": [],
            "image/svg+xml": [],
        },
        multiple: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // ensure there is either url or file
        if (!formData.pro_img && !file) {
            alert("ກະລຸນາເລືອກຮູບສິນຄ້າ");
            return;
        }

        setLoading(true);

        try {
            let imageUrl = formData.pro_img;

            // if user dropped a file, upload to storage
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('ap_system')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('ap_system')
                    .getPublicUrl(fileName);

                imageUrl = data.publicUrl;
            }

            const totalQty = parseInt(formData.quantity);
            const saleQty = parseInt(formData.qty_sale || "0");
            const { error: err } = await supabase
                .from("Product")
                .update({
                    pro_img: imageUrl || null,
                    pro_name: formData.pro_name,
                    sku: formData.sku,
                    quantity: (totalQty) > saleQty ? (totalQty - saleQty) : (saleQty || "0"),
                    qty_stock: (totalQty - saleQty) < 0 ? 0 : (totalQty - saleQty),
                    cost_price: parseFloat(formData.cost_price),
                    sell_price: parseFloat(formData.sell_price),
                    cate_id: parseInt(formData.cate_id),
                    user: user?.id,
                })
                .eq("id", parseInt(id || "0"));

            if (err) throw err;

            navigate("/product");
        } catch (err: any) {
            setError(err.message || "Failed to update product");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="space-y-2">
                        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    ແກ້ໄຂສິນຄ້າ
                </h1>
            </div>

            {loading && (
                <div className="p-4 mb-4 text-sm text-gray-800 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-200">
                    ກຳລັງກວດສອບ / ອັບໂຫຼດ... ກະລຸນາລໍຖ້າ
                </div>
            )}
            {error && (
                <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Product Image Dropzone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ຮູບໃຫຍ່
                        </label>
                        <div
                            {...getRootProps()}
                            className={`transition border border-gray-300 border-dashed cursor-pointer dark:hover:border-brand-500 dark:border-gray-700 rounded-xl hover:border-brand-500 p-7 lg:p-10
                                ${isDragActive
                                    ? "border-brand-500 bg-gray-100 dark:bg-gray-800"
                                    : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
                                }
                            `}
                        >
                            <input {...getInputProps()} />
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="preview"
                                    className="max-h-32 mx-auto"
                                />
                            ) : (
                                <>
                                    <div className="dz-message flex flex-col items-center m-0!">
                                        <div className="mb-[22px] flex justify-center">
                                            <div className="flex h-[68px] w-[68px]  items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                                                <svg
                                                    className="fill-current"
                                                    width="29"
                                                    height="28"
                                                    viewBox="0 0 29 28"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        clipRule="evenodd"
                                                        d="M14.5019 3.91699C14.2852 3.91699 14.0899 4.00891 13.953 4.15589L8.57363 9.53186C8.28065 9.82466 8.2805 10.2995 8.5733 10.5925C8.8661 10.8855 9.34097 10.8857 9.63396 10.5929L13.7519 6.47752V18.667C13.7519 19.0812 14.0877 19.417 14.5019 19.417C14.9161 19.417 15.2519 19.0812 15.2519 18.667V6.48234L19.3653 10.5929C19.6583 10.8857 20.1332 10.8855 20.426 10.5925C20.7188 10.2995 20.7186 9.82463 20.4256 9.53184L15.0838 4.19378C14.9463 4.02488 14.7367 3.91699 14.5019 3.91699ZM5.91626 18.667C5.91626 18.2528 5.58047 17.917 5.16626 17.917C4.75205 17.917 4.41626 18.2528 4.41626 18.667V21.8337C4.41626 23.0763 5.42362 24.0837 6.66626 24.0837H22.3339C23.5766 24.0837 24.5839 23.0763 24.5839 21.8337V18.667C24.5839 18.2528 24.2482 17.917 23.8339 17.917C23.4197 17.917 23.0839 18.2528 23.0839 18.667V21.8337C23.0839 22.2479 22.7482 22.5837 22.3339 22.5837H6.66626C6.25205 22.5837 5.91626 22.2479 5.91626 21.8337V18.667Z"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                        <h4 className="mb-3 font-semibold text-gray-800 text-theme-xl dark:text-white/90">
                                            {isDragActive ? "Drop Files Here" : "Drag & Drop Files Here"}
                                        </h4>
                                        <span className=" text-center mb-5 block w-full max-w-[290px] text-sm text-gray-700 dark:text-gray-400">
                                            Drag and drop your PNG, JPG, WebP, SVG images here or browse
                                        </span>
                                        <span className="font-medium underline text-theme-sm text-brand-500">
                                            Browse File
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {/* Product Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ຊື່ສິນຄ້າ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="pro_name"
                            value={formData.pro_name}
                            onChange={handleInputChange}
                            placeholder="ໃສ່ຊື່ສິນຄ້າ"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                    </div>

                    {/* SKU */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            SKU <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="sku"
                            value={formData.sku}
                            onChange={handleInputChange}
                            placeholder="SKU"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                    </div>

                    {/* Quantity (total) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ຈຳນວນ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            inputMode="numeric" pattern="[0-9]*"
                            name="quantity"
                            min="1"
                            value={formData.quantity}
                            onChange={handleInputChange}
                            placeholder="0"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                    </div>

                    {/* Cost Price */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ຕົ້ນທືນ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            inputMode="numeric" pattern="[0-9]*"
                            name="cost_price"
                            value={formData.cost_price}
                            onChange={handleInputChange}
                            placeholder="0"
                            step="0.01"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                    </div>

                    {/* Sell Price */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ລາຄາຂາຍ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            inputMode="numeric" pattern="[0-9]*"
                            name="sell_price"
                            value={formData.sell_price}
                            onChange={handleInputChange}
                            placeholder="0"
                            step="0.01"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ປະເພດ <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="cate_id"
                            value={formData.cate_id}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        >
                            <option value="" className="dark:bg-gray-500">ເລືອກປະເພດ</option>
                            {categories.map(cat => (
                                <option className="dark:bg-gray-500" key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                            <option value="new" className="dark:bg-gray-500">+ ເພີ່ມປະເພດລາຍການໃໝ່ </option>
                        </select>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => navigate("/product")}
                        >
                            ຍົກເລີກ
                        </Button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? "ກຳລັງລະວາງ..." : "ບັນທຶກ"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
