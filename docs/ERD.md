# Schoolify - Database Architecture (Entity Relationship Diagram)

> Sơ đồ quan hệ thực thể (ERD) được tạo tự động từ `schema.prisma`. GitHub tự động render sơ đồ Mermaid bên dưới.

```mermaid
erDiagram
    %% ==============================================
    %% 1. USER & MULTI-ROLE CORE
    %% ==============================================
    User {
        string id PK "UUID"
        SystemRole role "SUPER_ADMIN, USER"
        string fullname
        string avatar_url
        string email UK
        string phone
        string password_hash
        boolean status "Default: true"
        datetime last_login_at
        datetime created_at
        datetime updated_at
    }

    SchoolMember {
        string id PK "UUID"
        string user_id FK
        string school_id FK
        SchoolRole role "PRINCIPAL, TEACHER, STUDENT, PARENT..."
        datetime joined_at
    }

    TeacherProfile {
        string id PK "UUID"
        string user_id FK,UK
        string department_id FK
        string bio
        string expertise
        int experience_years
    }

    StudentProfile {
        string id PK "UUID"
        string user_id FK,UK
        datetime date_of_birth
        string grade_level
        int points "Default: 0"
    }

    ParentProfile {
        string id PK "UUID"
        string user_id FK,UK
        string job_title
        string address
    }

    ParentStudent {
        string id PK "UUID"
        string parent_id FK
        string student_id FK
        string relationship_type "PARENT, MOTHER, FATHER..."
        datetime created_at
    }

    CustomFeatureRequest {
        string id PK "UUID"
        string user_id FK
        string request_content
        string phone
        string contact_info
        CustomRequestStatus status
        datetime created_at
    }

    Notification {
        string id PK "UUID"
        string user_id FK
        string title
        string message
        boolean is_read "Default: false"
        datetime created_at
    }

    %% ==============================================
    %% 2. SCHOOL & MULTI-TENANT
    %% ==============================================
    School {
        string id PK "UUID"
        string owner_id FK
        string name
        string code UK
        string address
        string phone
        string email
        SchoolStatus status "ACTIVE, INACTIVE, SUSPENDED"
        datetime created_at
        datetime updated_at
    }

    Department {
        string id PK "UUID"
        string school_id FK
        string name
        string head_teacher_id FK
        datetime created_at
        datetime updated_at
    }

    %% ==============================================
    %% 3. SAAS & SUBSCRIPTIONS (B2B & B2C)
    %% ==============================================
    SubscriptionPackage {
        string id PK "UUID"
        string creator_id FK
        string name
        string description
        decimal price "10,2"
        BillingCycle billing_cycle "MONTHLY, YEARLY, LIFETIME"
        int duration_days
        int max_teachers
        int max_students_total
        int max_classes
        int max_students_per_class
        int storage_limit_gb
        boolean can_sell_courses
        boolean is_active
        json features
        json custom_features
        datetime created_at
        datetime updated_at
    }

    SchoolSubscription {
        string id PK "UUID"
        string school_id FK
        string package_id FK
        json features_snapshot
        datetime start_date
        datetime end_date
        SubscriptionStatus status "TRIALING, ACTIVE, EXPIRED..."
        datetime created_at
    }

    TeacherSubscription {
        string id PK "UUID"
        string teacher_id FK
        string package_id FK
        json features_snapshot
        datetime start_date
        datetime end_date
        SubscriptionStatus status "TRIALING, ACTIVE, EXPIRED..."
        datetime created_at
    }

    %% ==============================================
    %% 4. COURSES, LESSONS & CATEGORIES
    %% ==============================================
    Category {
        string id PK "UUID"
        string name
        string slug UK
        string parent_id FK
        string status
        int sort_order
        datetime created_at
        datetime updated_at
    }

    Course {
        string id PK "UUID"
        string school_id FK
        string department_id FK
        string subject_id FK
        string owner_id FK
        string title
        string description
        decimal price "10,2"
        boolean is_marketplace
        CourseStatus status "DRAFT, PENDING, PUBLISHED..."
        datetime published_at
        datetime created_at
        datetime updated_at
    }

    Lesson {
        string id PK "UUID"
        string course_id FK
        string title
        string content
        string video_url
        int order_index
        datetime created_at
        datetime updated_at
    }

    LessonMaterial {
        string id PK "UUID"
        string lesson_id FK
        MaterialType material_type "IMG, DOCX, EXCEL"
        string url
        string content_data
        int order_index
    }

    %% ==============================================
    %% 5. CLASSES & SCHEDULING (TIMETABLE)
    %% ==============================================
    Class {
        string id PK "UUID"
        string school_id FK
        string teacher_id FK
        string course_id FK
        string class_name
        ClassStatus status "DRAFT, PENDING, PUBLISHED..."
        datetime created_at
        datetime updated_at
    }

    ClassEnrollment {
        string id PK "UUID"
        string class_id FK
        string student_id FK
        datetime joined_date
    }

    ClassCourse {
        string id PK "UUID"
        string teacher_id FK
        string course_id FK
        string class_id FK
    }

    ClassSession {
        string id PK "UUID"
        string class_id FK
        string teacher_id FK
        string title
        datetime start_time
        datetime end_time
        string room
        string meeting_url
        datetime created_at
        datetime updated_at
    }

    %% ==============================================
    %% 6. QUESTIONS & EXAMS & SUBMISSIONS
    %% ==============================================
    QuestionBank {
        string id PK "UUID"
        string title
        string owner_id FK
        string school_id FK
        boolean is_premium
        datetime created_at
        datetime updated_at
    }

    Question {
        string id PK "UUID"
        string bank_id FK
        string lesson_id FK
        QuestionType type "MULTIPLE_CHOICE, ESSAY..."
        string title
        string question
        string answer
        datetime created_at
    }

    Answer {
        string id PK "UUID"
        string question_id FK
        string content
        string explain
        string img_url
        boolean is_answer
    }

    ExamSubmission {
        string id PK "UUID"
        string student_id FK
        string bank_id FK
        string lesson_id FK
        string class_id FK
        SubmissionStatus status "IN_PROGRESS, SUBMITTED, GRADED..."
        decimal score "5,2"
        datetime started_at
        datetime submitted_at
        datetime graded_at
        string teacher_notes
    }

    SubmissionAnswer {
        string id PK "UUID"
        string submission_id FK
        string question_id FK
        string selected_answer_id FK
        string text_answer
        boolean is_correct
        decimal points_earned "5,2"
        string teacher_feedback
    }

    StudentProgress {
        string id PK "UUID"
        string student_id FK
        string course_id FK
        string lesson_id FK
        int completion_pct
        datetime last_accessed
        boolean is_completed
    }

    %% ==============================================
    %% 7. GAMIFICATION & STORE
    %% ==============================================
    StoreItem {
        string id PK "UUID"
        string teacher_id FK
        string user_id FK
        StoreItemType type "VOUCHER, BADGE, THEME..."
        string name
        string description
        int points
        int stock
        string image_url
        ItemStatus status
        datetime expired
        datetime created_at
        datetime updated_at
    }

    StudentInventory {
        string id PK "UUID"
        string student_id FK
        string item_id FK
        string type
        int points
        datetime buy_at
        boolean active
    }

    %% ==============================================
    %% 8. ORDERS & TRANSACTIONS
    %% ==============================================
    Order {
        string id PK "UUID"
        string user_id FK
        OrderReferenceType reference_type "SUBSCRIPTION, COURSE"
        string subscription_id FK
        string course_id FK
        json item_name_snapshot
        decimal item_price_snapshot "10,2"
        OrderStatus status "PENDING, PAID, CANCELLED"
        PaymentMethod payment_method "COD, BANK"
        string seller_id FK
        datetime created_at
        datetime updated_at
    }

    Transaction {
        string id PK "UUID"
        string order_id FK
        TransactionType transaction_type "PAYMENT_TO_ADMIN, COMMISSION_FEE, TEACHER_INCOME"
        decimal amount "10,2"
        string recipient_id
        datetime created_at
    }

    %% ==============================================
    %% RELATIONSHIPS
    %% ==============================================
    User ||--o{ SchoolMember : "memberships"
    School ||--o{ SchoolMember : "members"
    User ||--o| TeacherProfile : "profile"
    User ||--o| StudentProfile : "profile"
    User ||--o| ParentProfile : "profile"
    ParentProfile ||--o{ ParentStudent : "parent_of"
    StudentProfile ||--o{ ParentStudent : "children_of"
    User ||--o{ School : "owns"
    User ||--o{ Notification : "receives"
    User ||--o{ CustomFeatureRequest : "requests"
    
    School ||--o{ Department : "departments"
    Department ||--o{ TeacherProfile : "teachers"
    TeacherProfile ||--o| Department : "heads"
    
    School ||--o{ SchoolSubscription : "subscriptions"
    SubscriptionPackage ||--o{ SchoolSubscription : "plans"
    TeacherProfile ||--o{ TeacherSubscription : "subscriptions"
    SubscriptionPackage ||--o{ TeacherSubscription : "plans"
    
    Category ||--o{ Category : "sub_categories"
    Category ||--o{ Course : "courses"
    School ||--o{ Course : "courses"
    Department ||--o{ Course : "courses"
    TeacherProfile ||--o{ Course : "courses"
    Course ||--o{ Lesson : "lessons"
    Lesson ||--o{ LessonMaterial : "materials"
    
    School ||--o{ Class : "classes"
    TeacherProfile ||--o{ Class : "manages"
    Class ||--o{ ClassEnrollment : "enrollments"
    StudentProfile ||--o{ ClassEnrollment : "enrolled_in"
    Class ||--o{ ClassCourse : "courses"
    Course ||--o{ ClassCourse : "classes"
    TeacherProfile ||--o{ ClassCourse : "teaches"
    Class ||--o{ ClassSession : "sessions"
    TeacherProfile ||--o{ ClassSession : "instructs"
    
    User ||--o{ QuestionBank : "banks"
    School ||--o{ QuestionBank : "banks"
    QuestionBank ||--o{ Question : "questions"
    Lesson ||--o{ Question : "questions"
    Question ||--o{ Answer : "answers"
    
    StudentProfile ||--o{ ExamSubmission : "submissions"
    QuestionBank ||--o{ ExamSubmission : "submissions"
    Lesson ||--o{ ExamSubmission : "submissions"
    Class ||--o{ ExamSubmission : "submissions"
    ExamSubmission ||--o{ SubmissionAnswer : "answers"
    Question ||--o{ SubmissionAnswer : "answers"
    Answer ||--o| SubmissionAnswer : "selected"
    
    StudentProfile ||--o{ StudentProgress : "progress"
    Course ||--o{ StudentProgress : "progress"
    Lesson ||--o{ StudentProgress : "progress"
    
    TeacherProfile ||--o{ StoreItem : "store_items"
    User ||--o{ StoreItem : "store_items"
    StoreItem ||--o{ StudentInventory : "inventory"
    StudentProfile ||--o{ StudentInventory : "inventory"
    
    User ||--o{ Order : "orders_purchased"
    User ||--o{ Order : "orders_sold"
    SubscriptionPackage ||--o{ Order : "orders"
    Course ||--o{ Order : "orders"
    Order ||--o{ Transaction : "transactions"
```
