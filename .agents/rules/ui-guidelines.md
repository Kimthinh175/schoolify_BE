---
name: UI/UX Brand and Responsive Guidelines
description: Rules for frontend development regarding brand identity and responsive design.
trigger: always_on
---

# UI/UX Development Rules

Khi thực hiện công việc liên quan đến giao diện (FE) trong dự án này, Agent BẮT BUỘC phải tuân thủ 2 nguyên tắc sau:

1. **Nhận diện thương hiệu (Brand Identity):**
   - Mọi components và giao diện mới đều phải tuân thủ nghiêm ngặt nhận diện thương hiệu của dự án.
   - Bám sát các màu sắc (colors), kiểu chữ (typography), và các components cốt lõi đã được định nghĩa trong `src/components/ui/` và Tailwind config.

2. **Thiết kế thích ứng (Responsive Design):**
   - Mọi giao diện (page, layout, component) luôn phải hỗ trợ hiển thị tốt trên Mobile và Tablet.
   - Áp dụng phương pháp tiếp cận Mobile-first của Tailwind CSS.
   - Bắt buộc phải sử dụng các modifier như `sm:`, `md:`, `lg:` để điều chỉnh bố cục cho phù hợp với từng kích thước màn hình.
